import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function ensureAdmin(context: any): Promise<void> {
  const { data: isAdmin, error } = await context.supabase.rpc("is_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Sem permissão.");
}

/* ============================================================
 * DASHBOARD EXTRAS — KPIs adicionais + gráfico + atividade
 * ============================================================ */

export type DashboardExtras = {
  totalDepositsPaid: number;
  totalDepositsCount: number;
  depositsToday: number;
  totalCommissionsPaid: number;
  totalWithdrawalsPaid: number;
  totalAdminCredits: number;
  totalAdminDebits: number;
  totalManualAdjustments: number;
  webhooksTotal: number;
  webhooksProcessed: number;
  webhooksErrors: number;
  webhooksPending: number;
  divergencesCount: number;
  netRevenue: number; // depósitos reais - saques - comissões pagas
};


export const getAdminDashboardExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardExtras> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      { data: deps },
      { data: depsToday },
      { data: comms },
      { data: wds },
      { count: whTotal },
      { count: whOk },
      { count: whErr },
      { count: whPending },
    ] = await Promise.all([
      supabaseAdmin.from("deposits").select("amount").in("status", ["paid", "approved"]),
      supabaseAdmin.from("deposits").select("amount").in("status", ["paid", "approved"]).gte("credited_at", todayStart.toISOString()),
      (supabaseAdmin.from("commissions") as any).select("amount").eq("status", "paid"),
      (supabaseAdmin.from("affiliate_withdrawals") as any).select("amount").eq("status", "paid"),
      supabaseAdmin.from("payment_webhook_logs").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("payment_webhook_logs").select("id", { count: "exact", head: true }).eq("processed", true).is("processing_error", null),
      supabaseAdmin.from("payment_webhook_logs").select("id", { count: "exact", head: true }).not("processing_error", "is", null),
      supabaseAdmin.from("payment_webhook_logs").select("id", { count: "exact", head: true }).eq("processed", false),
    ]);

    const sum = (rows: any[] | null) =>
      (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const totalDepositsPaid = sum(deps as any[]);
    const depositsToday = sum(depsToday as any[]);
    const totalCommissionsPaid = sum(comms as any[]);
    const totalWithdrawalsPaid = sum(wds as any[]);

    // divergências: paid_without_credit + missing_wallet_tx (via função existente reconcile_payments)
    let divergencesCount = 0;
    try {
      const { data: divs } = await supabaseAdmin.rpc("reconcile_payments" as any);
      divergencesCount = Array.isArray(divs) ? (divs as any[]).length : 0;
    } catch {
      // função pode não existir ainda
    }

    return {
      totalDepositsPaid,
      totalDepositsCount: (deps ?? []).length,
      depositsToday,
      totalCommissionsPaid,
      totalWithdrawalsPaid,
      webhooksTotal: whTotal ?? 0,
      webhooksProcessed: whOk ?? 0,
      webhooksErrors: whErr ?? 0,
      webhooksPending: whPending ?? 0,
      divergencesCount,
      netRevenue: totalDepositsPaid - totalWithdrawalsPaid - totalCommissionsPaid,
    };
  });

/* ============================================================
 * SÉRIE TEMPORAL — depósitos por dia (últimos N dias)
 * ============================================================ */

export type DailyPoint = { day: string; deposits: number; count: number };

export const getDepositsTimeSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ days: z.number().int().min(1).max(60).default(14) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<DailyPoint[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (data.days - 1));

    const { data: rows, error } = await supabaseAdmin
      .from("deposits")
      .select("amount, credited_at")
      .in("status", ["paid", "approved"])
      .gte("credited_at", start.toISOString());
    if (error) throw new Error(error.message);

    // bucket por dia UTC
    const buckets = new Map<string, { deposits: number; count: number }>();
    for (let i = 0; i < data.days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { deposits: 0, count: 0 });
    }
    for (const r of (rows ?? []) as Array<{ amount: number; credited_at: string | null }>) {
      if (!r.credited_at) continue;
      const key = r.credited_at.slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.deposits += Number(r.amount ?? 0);
      b.count += 1;
    }
    return Array.from(buckets.entries()).map(([day, v]) => ({ day, ...v }));
  });

/* ============================================================
 * ATIVIDADE RECENTE — mescla depósitos, saques e alertas
 * ============================================================ */

export type ActivityRow = {
  id: string;
  kind: "deposit" | "withdrawal" | "alert" | "webhook_error";
  title: string;
  amount: number | null;
  user_name: string | null;
  status: string | null;
  created_at: string;
};

export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivityRow[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: deps }, { data: wds }, { data: alerts }, { data: whErrs }] =
      await Promise.all([
        supabaseAdmin
          .from("deposits")
          .select("id, amount, status, user_id, created_at, credited_at")
          .in("status", ["paid", "approved"])
          .order("credited_at", { ascending: false })
          .limit(8),
        supabaseAdmin
          .from("affiliate_withdrawals")
          .select("id, amount, status, user_id, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseAdmin
          .from("risk_alerts")
          .select("id, title, severity, status, user_id, created_at")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(6),
        supabaseAdmin
          .from("payment_webhook_logs")
          .select("id, provider_transaction_id, processing_error, created_at")
          .not("processing_error", "is", null)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

    const userIds = new Set<string>();
    for (const d of (deps ?? []) as any[]) if (d.user_id) userIds.add(d.user_id);
    for (const w of (wds ?? []) as any[]) if (w.user_id) userIds.add(w.user_id);
    for (const a of (alerts ?? []) as any[]) if (a.user_id) userIds.add(a.user_id);

    const names = new Map<string, string | null>();
    if (userIds.size) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(userIds));
      for (const p of profs ?? []) names.set(p.id, (p as any).display_name ?? null);
    }

    const rows: ActivityRow[] = [];
    for (const d of (deps ?? []) as any[]) {
      rows.push({
        id: `dep-${d.id}`,
        kind: "deposit",
        title: "Depósito confirmado",
        amount: Number(d.amount),
        user_name: names.get(d.user_id) ?? null,
        status: d.status,
        created_at: d.credited_at ?? d.created_at,
      });
    }
    for (const w of (wds ?? []) as any[]) {
      rows.push({
        id: `wd-${w.id}`,
        kind: "withdrawal",
        title: `Saque ${w.status}`,
        amount: Number(w.amount),
        user_name: names.get(w.user_id) ?? null,
        status: w.status,
        created_at: w.created_at,
      });
    }
    for (const a of (alerts ?? []) as any[]) {
      rows.push({
        id: `al-${a.id}`,
        kind: "alert",
        title: a.title,
        amount: null,
        user_name: a.user_id ? names.get(a.user_id) ?? null : null,
        status: a.severity,
        created_at: a.created_at,
      });
    }
    for (const w of (whErrs ?? []) as any[]) {
      rows.push({
        id: `we-${w.id}`,
        kind: "webhook_error",
        title: `Webhook falhou: ${w.processing_error?.slice(0, 60) ?? "erro"}`,
        amount: null,
        user_name: null,
        status: "error",
        created_at: w.created_at,
      });
    }
    return rows
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 20);
  });

/* ============================================================
 * DIVERGÊNCIAS — pagamentos aprovados na Diggion sem crédito local,
 *                ou com valor divergente
 * ============================================================ */

export type DivergenceRow = {
  kind: "paid_without_credit" | "missing_wallet_tx" | "wallet_amount_mismatch" | "webhook_paid_no_deposit";
  deposit_id: string | null;
  user_id: string | null;
  user_name: string | null;
  expected: number | null;
  actual: number | null;
  detail: string;
  created_at: string | null;
  provider_tx_id: string | null;
};

export const getPaymentDivergences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DivergenceRow[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows: DivergenceRow[] = [];

    // 1) Divergências já cobertas pela função SQL reconcile_payments
    try {
      const { data: divs } = await supabaseAdmin.rpc("reconcile_payments" as any);
      const arr = (Array.isArray(divs) ? divs : []) as any[];
      const userIds = Array.from(new Set(arr.map((r) => r.user_id).filter(Boolean)));
      const names = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        for (const p of profs ?? []) names.set(p.id, (p as any).display_name ?? null);
      }
      for (const r of arr) {
        if (!["paid_without_credit", "missing_wallet_tx", "wallet_amount_mismatch"].includes(r.kind)) continue;
        rows.push({
          kind: r.kind,
          deposit_id: r.deposit_id ?? null,
          user_id: r.user_id ?? null,
          user_name: r.user_id ? names.get(r.user_id) ?? null : null,
          expected: r.expected != null ? Number(r.expected) : null,
          actual: r.actual != null ? Number(r.actual) : null,
          detail: r.detail ?? "",
          created_at: null,
          provider_tx_id: null,
        });
      }
    } catch {
      // ignore
    }

    // 2) Webhooks marcados como pagos que não têm depósito correspondente creditado
    const { data: whs } = await supabaseAdmin
      .from("payment_webhook_logs")
      .select("id, provider_transaction_id, payload, created_at")
      .eq("provider", "diggion")
      .not("provider_transaction_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const paidWebhooks = ((whs ?? []) as any[]).filter((w) => {
      const p = w.payload ?? {};
      const s = (p?.data?.payment_status ?? p?.data?.status ?? p?.status ?? "").toString().toLowerCase();
      return ["paid", "approved", "completed", "credited"].includes(s);
    });
    const txIds = paidWebhooks.map((w) => w.provider_transaction_id).filter(Boolean) as string[];
    if (txIds.length) {
      const { data: deps } = await supabaseAdmin
        .from("deposits")
        .select("external_id, credited_at, status, user_id")
        .in("external_id", txIds)
        .eq("provider", "diggion");
      const depMap = new Map<string, any>();
      for (const d of deps ?? []) depMap.set((d as any).external_id, d);

      for (const w of paidWebhooks) {
        const d = depMap.get(w.provider_transaction_id);
        if (!d || !d.credited_at) {
          rows.push({
            kind: "webhook_paid_no_deposit",
            deposit_id: null,
            user_id: d?.user_id ?? null,
            user_name: null,
            expected: null,
            actual: null,
            detail: d
              ? `Depósito existe mas não foi creditado (status=${d.status}). Reprocesse via webhooks.`
              : `Webhook aprovado sem depósito local vinculado (tx=${w.provider_transaction_id}).`,
            created_at: w.created_at,
            provider_tx_id: w.provider_transaction_id,
          });
        }
      }
    }

    return rows;
  });

/* ============================================================
 * GERAR ALERTAS a partir de divergências
 * ============================================================ */

export const generateDivergenceAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ created: number }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const divs = await getPaymentDivergences();
    let created = 0;
    for (const d of divs) {
      // dedupe: existe alerta aberto para este depósito/tx?
      const key = d.deposit_id ?? d.provider_tx_id;
      if (!key) continue;
      const { data: existing } = await supabaseAdmin
        .from("risk_alerts")
        .select("id")
        .eq("status", "open")
        .eq("type", `divergence.${d.kind}`)
        .ilike("description", `%${key}%`)
        .maybeSingle();
      if (existing) continue;

      const { error } = await supabaseAdmin.from("risk_alerts").insert({
        user_id: d.user_id,
        type: `divergence.${d.kind}`,
        severity: d.kind === "webhook_paid_no_deposit" ? "critical" : "high",
        title: divergenceTitle(d.kind),
        description: `${d.detail} [ref=${key}]`,
        status: "open",
      });
      if (!error) created += 1;
    }
    return { created };
  });

function divergenceTitle(kind: DivergenceRow["kind"]): string {
  switch (kind) {
    case "paid_without_credit": return "Depósito pago sem crédito registrado";
    case "missing_wallet_tx": return "Depósito pago sem lançamento na carteira";
    case "wallet_amount_mismatch": return "Valor de carteira diferente do depósito";
    case "webhook_paid_no_deposit": return "Webhook aprovado sem depósito creditado";
  }
}

/* ============================================================
 * REPROCESSAR WEBHOOK — reconsulta Diggion e credita atomicamente
 * ============================================================ */

export const reprocessWebhookById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ webhookId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { DiggionPayService } = await import("./diggion.server");

    const { data: log, error } = await supabaseAdmin
      .from("payment_webhook_logs")
      .select("id, provider, provider_transaction_id")
      .eq("id", data.webhookId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!log) throw new Error("Webhook não encontrado.");
    if (log.provider !== "diggion") throw new Error("Reprocesso disponível apenas para Diggion.");
    if (!log.provider_transaction_id) throw new Error("Webhook sem provider_transaction_id.");

    const tx = await DiggionPayService.getTransaction(log.provider_transaction_id);
    const normalized = DiggionPayService.normalizeStatus(tx.status);

    const { data: dep } = await supabaseAdmin
      .from("deposits")
      .select("id, amount")
      .eq("provider", "diggion")
      .eq("external_id", log.provider_transaction_id)
      .maybeSingle();

    if (!dep) {
      await supabaseAdmin
        .from("payment_webhook_logs")
        .update({ processed: true, processing_error: "deposit not found (reprocess)" })
        .eq("id", log.id);
      return { ok: false, result: "deposit_not_found", provider_status: tx.status };
    }

    if (normalized === "paid") {
      // SEGURANÇA: reprocesso manual NÃO credita. Apenas o webhook oficial
      // assinado da Diggion pode chamar credit_deposit_atomic. Registramos
      // a tentativa em auditoria para acompanhamento.
      const { auditLog } = await import("./audit.functions");
      await auditLog(supabaseAdmin, {
        eventType: "DEPOSIT_RECONCILE_PAID_BLOCKED",
        module: "deposits",
        severity: "warning",
        title: `Reprocesso admin viu 'paid' sem webhook — crédito bloqueado (${dep.id})`,
        metadata: { depositId: dep.id, providerTx: log.provider_transaction_id, providerStatus: tx.status, webhookLogId: log.id },
        entityType: "deposit",
        entityId: dep.id,
        userId: context.userId,
      });
      await supabaseAdmin
        .from("payment_webhook_logs")
        .update({ processed: true, processing_error: "paid_awaiting_signed_webhook" })
        .eq("id", log.id);
      return { ok: false, result: "paid_awaiting_webhook", provider_status: tx.status };
    }

    if (["expired", "canceled", "refunded", "chargeback"].includes(normalized)) {
      await supabaseAdmin.from("deposits").update({ status: normalized as any }).eq("id", dep.id);
      await supabaseAdmin.from("payment_webhook_logs").update({ processed: true }).eq("id", log.id);
      return { ok: true, result: normalized, provider_status: tx.status };
    }
    return { ok: true, result: "still_pending", provider_status: tx.status };
  });
