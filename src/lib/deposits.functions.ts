import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CPF_RE = /^\d{11}$/;
const MIN_DEPOSIT = 20; // R$
const MAX_DEPOSIT = 5000; // R$

function onlyDigits(s: string): string {
  return String(s || "").replace(/\D+/g, "");
}

function getBaseUrl(): string {
  return (
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_APP_PUBLIC_URL ||
    "https://helixfast.lovable.app"
  ).replace(/\/$/, "");
}

/* ============================ CREATE DEPOSIT ============================ */

export const createDiggionDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amount: z.number().min(MIN_DEPOSIT).max(MAX_DEPOSIT),
        cpf: z
          .string()
          .transform(onlyDigits)
          .refine((v) => CPF_RE.test(v), "CPF inválido"),
        fullName: z.string().trim().min(3).max(120),
        email: z.string().trim().email().max(200),
        phone: z
          .string()
          .transform(onlyDigits)
          .refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Persist KYC no profile (uma vez)
    await supabase
      .from("profiles")
      .update({
        cpf: data.cpf,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
      })
      .eq("id", userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { DiggionPayService } = await import("./diggion.server");

    const idempotencyKey = `dep_${userId}_${Math.round(data.amount * 100)}_${Date.now()}`;
    const amountCents = Math.round(data.amount * 100);

    // 1. Cria depósito local com status pending
    const { data: dep, error: insErr } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: userId,
        amount: data.amount,
        currency: "BRL",
        provider: "diggion",
        payment_method: "pix",
        status: "pending",
        idempotency_key: idempotencyKey,
      })
      .select()
      .single();
    if (insErr || !dep) {
      throw new Error(`Falha ao criar depósito: ${insErr?.message ?? "unknown"}`);
    }

    const webhookSecret = process.env.DIGGION_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("DIGGION_WEBHOOK_SECRET não configurado");
    const postbackUrl = `${getBaseUrl()}/api/public/webhooks/diggion/${webhookSecret}`;

    // Mapeamento de offer_hash por valor (centavos)
    const OFFER_HASH_BY_AMOUNT: Record<number, string> = {
      500: "b8d7p",   // R$ 5,00
      1000: "ifnis",  // R$ 10,00
    };
    const offerHash = OFFER_HASH_BY_AMOUNT[amountCents] ?? process.env.DIGGION_OFFER_HASH;
    const productHash = process.env.DIGGION_PRODUCT_HASH;
    if (!offerHash || !productHash) {
      throw new Error("DIGGION_OFFER_HASH/DIGGION_PRODUCT_HASH não configurados");
    }

    // 2. Cria cobrança na Diggion
    let created;
    try {
      created = await DiggionPayService.createTransaction({
        amountCents,
        postbackUrl,
        offerHash,
        productHash,
        productTitle: "Depósito Helix Fast",
        customer: {
          name: data.fullName,
          email: data.email,
          phone: data.phone,
          document: data.cpf,
        },
        paymentMethod: "pix",
        expireInDays: 1,
      });
    } catch (e: any) {
      await supabaseAdmin
        .from("deposits")
        .update({ status: "failed", last_error: String(e?.message ?? e) })
        .eq("id", dep.id);
      throw new Error("Falha ao gerar PIX na Diggion. Tente novamente.");
    }

    // 3. Salva dados do provider
    await supabaseAdmin
      .from("deposits")
      .update({
        status: "waiting_payment",
        external_id: created.hash,
        qr_code: created.qr_code || null,
        qr_code_base64: null,
        copy_paste_code: created.copy_paste || created.qr_code || null,
        checkout_url: created.checkout_url || null,
        expires_at: created.expires_at ? new Date(created.expires_at).toISOString() : null,
        response_payload: created.raw as any,
      })
      .eq("id", dep.id);

    return {
      depositId: dep.id,
      status: "waiting_payment" as const,
      providerTransactionId: created.hash,
      qrCode: created.qr_code || null,
      copyPasteCode: created.copy_paste || created.qr_code || null,
      checkoutUrl: created.checkout_url || null,
      expiresAt: created.expires_at || null,
      amount: data.amount,
    };
  });

/* ============================ STATUS ============================ */

export const getDepositStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ depositId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: dep, error } = await supabase
      .from("deposits")
      .select("id, amount, status, external_id, qr_code, copy_paste_code, checkout_url, expires_at, paid_at, credited_at")
      .eq("id", data.depositId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dep) throw new Error("Depósito não encontrado");
    return dep;
  });

/* ============================ RECONCILE (admin) ============================ */

export const reconcilePendingDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin only
    const { data: adm } = await context.supabase
      .rpc("is_admin", { _user_id: context.userId });
    if (!adm) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { DiggionPayService } = await import("./diggion.server");

    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: pending } = await supabaseAdmin
      .from("deposits")
      .select("id, external_id, amount")
      .eq("provider", "diggion")
      .in("status", ["waiting_payment", "pending"])
      .not("external_id", "is", null)
      .lt("updated_at", cutoff)
      .limit(50);

    const results: Array<{ id: string; result: string }> = [];
    for (const d of pending ?? []) {
      try {
        const tx = await DiggionPayService.getTransaction(d.external_id!);
        const normalized = DiggionPayService.normalizeStatus(tx.status);
        if (normalized === "paid") {
          const { data: cred } = await supabaseAdmin.rpc("credit_deposit_atomic", {
            _deposit_id: d.id,
            _expected_amount: (tx.amount ?? d.amount * 100) / 100,
            _provider_tx_id: tx.hash,
          });
          results.push({ id: d.id, result: (cred as any)?.reason ?? "credited" });
        } else if (["expired", "canceled", "refunded", "chargeback"].includes(normalized)) {
          await supabaseAdmin.from("deposits").update({ status: normalized as any }).eq("id", d.id);
          results.push({ id: d.id, result: normalized });
        } else {
          results.push({ id: d.id, result: "still_pending" });
        }
      } catch (e: any) {
        results.push({ id: d.id, result: `error:${String(e?.message ?? e).slice(0, 80)}` });
      }
    }
    return { checked: results.length, results };
  });

/* ============================ ADMIN: LIST DIGGION DEPOSITS ============================ */

export type AdminDigginDepositRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  amount: number;
  status: string;
  external_id: string | null;
  provider: string;
  created_at: string;
  paid_at: string | null;
  credited_at: string | null;
  expires_at: string | null;
  last_error: string | null;
};

export const listDiggionDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: AdminDigginDepositRow[] }> => {
    const { data: adm } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!adm) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("deposits")
      .select("id, user_id, amount, status, external_id, provider, created_at, paid_at, credited_at, expires_at, last_error")
      .eq("provider", "diggion")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.search) {
      const s = data.search.trim();
      if (s) q = q.or(`external_id.ilike.%${s}%,id.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const nameMap = new Map<string, string | null>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds as any);
      for (const p of profs ?? []) nameMap.set(p.id, p.display_name);
    }

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        user_name: nameMap.get(r.user_id) ?? null,
      })),
    };
  });

/* ============================ ADMIN: RECONCILE ONE ============================ */

export const reconcileDepositById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ depositId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: adm } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!adm) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { DiggionPayService } = await import("./diggion.server");

    const { data: d, error } = await supabaseAdmin
      .from("deposits")
      .select("id, external_id, amount, status")
      .eq("id", data.depositId)
      .eq("provider", "diggion")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!d) throw new Error("Depósito não encontrado");
    if (!d.external_id) return { ok: false, result: "sem_external_id" };

    const tx = await DiggionPayService.getTransaction(d.external_id);
    const normalized = DiggionPayService.normalizeStatus(tx.status);

    if (normalized === "paid") {
      const { data: cred } = await supabaseAdmin.rpc("credit_deposit_atomic", {
        _deposit_id: d.id,
        _expected_amount: (tx.amount ?? Number(d.amount) * 100) / 100,
        _provider_tx_id: tx.hash,
      });
      return { ok: true, result: (cred as any)?.reason ?? "credited", provider_status: tx.status };
    }
    if (["expired", "canceled", "refunded", "chargeback"].includes(normalized)) {
      await supabaseAdmin.from("deposits").update({ status: normalized as any }).eq("id", d.id);
      return { ok: true, result: normalized, provider_status: tx.status };
    }
    return { ok: true, result: "ainda_pendente", provider_status: tx.status };
  });
