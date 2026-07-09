import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(context: any): Promise<void> {
  const { data: isAdmin, error } = await context.supabase.rpc("is_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Acesso negado.");
}

export type AdminWebhookRow = {
  id: string;
  created_at: string;
  provider: string;
  event_id: string | null;
  provider_transaction_id: string | null;
  signature_valid: boolean | null;
  processed: boolean | null;
  processing_error: string | null;
  payment_status: string | null;
  amount: number | null;
  offer_hash: string | null;
  user_id: string | null;
  user_name: string | null;
  deposit_id: string | null;
  deposit_status: string | null;
  balance_before: number | null;
  balance_after: number | null;
  raw_payload: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const parts = k.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = obj;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (typeof cur === "string" && cur.length > 0) return cur;
  }
  return null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickNumber(obj: any, keys: string[]): number | null {
  for (const k of keys) {
    const parts = k.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = obj;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (typeof cur === "number" && Number.isFinite(cur)) return cur;
    if (typeof cur === "string" && cur.trim() !== "" && !isNaN(Number(cur))) return Number(cur);
  }
  return null;
}

export const listAdminWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        search: z.string().trim().optional(),
        status: z.enum(["all", "processed", "pending", "error", "invalid_signature"]).default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: AdminWebhookRow[]; total: number }> => {
    await ensureAdmin(context);
    const { supabase } = context;
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("payment_webhook_logs")
      .select(
        "id, created_at, provider, event_id, provider_transaction_id, signature_valid, processed, processing_error, payload",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.status === "processed") q = q.eq("processed", true).is("processing_error", null);
    else if (data.status === "pending") q = q.eq("processed", false);
    else if (data.status === "error") q = q.not("processing_error", "is", null);
    else if (data.status === "invalid_signature") q = q.eq("signature_valid", false);

    if (data.search && data.search.length > 0) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(
        `provider_transaction_id.ilike.%${s}%,event_id.ilike.%${s}%,processing_error.ilike.%${s}%`,
      );
    }

    const { data: logs, error, count } = await q;
    if (error) throw new Error(error.message);

    const txIds = Array.from(
      new Set((logs ?? []).map((l) => l.provider_transaction_id).filter((v): v is string => !!v)),
    );

    const depositsById = new Map<
      string,
      {
        id: string;
        amount: number;
        status: string;
        user_id: string;
        request_payload: unknown;
      }
    >();
    if (txIds.length > 0) {
      const { data: deps } = await supabase
        .from("deposits")
        .select("id, amount, status, user_id, request_payload, external_id")
        .in("external_id", txIds)
        .eq("provider", "diggion");
      for (const d of deps ?? []) {
        if (d.external_id) depositsById.set(d.external_id, d as never);
      }
    }

    const depositIds = Array.from(depositsById.values()).map((d) => d.id);
    const walletByDeposit = new Map<string, { balance_before: number; balance_after: number }>();
    const userIds = new Set<string>();
    for (const d of depositsById.values()) userIds.add(d.user_id);

    if (depositIds.length > 0) {
      const { data: wts } = await supabase
        .from("wallet_transactions")
        .select("deposit_id, balance_before, balance_after")
        .in("deposit_id", depositIds)
        .eq("type", "deposit");
      for (const w of wts ?? []) {
        if (w.deposit_id) {
          walletByDeposit.set(w.deposit_id, {
            balance_before: Number(w.balance_before),
            balance_after: Number(w.balance_after),
          });
        }
      }
    }

    const usersById = new Map<string, string | null>();
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(userIds));
      for (const p of profs ?? []) usersById.set(p.id, p.display_name ?? null);
    }

    const rows: AdminWebhookRow[] = (logs ?? []).map((l) => {
      const payload = l.payload as unknown;
      const tx = l.provider_transaction_id;
      const dep = tx ? depositsById.get(tx) : undefined;
      const wt = dep ? walletByDeposit.get(dep.id) : undefined;
      const paymentStatus =
        pickString(payload, [
          "data.payment_status",
          "data.status",
          "data.transaction_status",
          "data.current_status",
          "payment_status",
          "status",
          "transaction.status",
        ]) ?? null;
      const amountCents = pickNumber(payload, ["data.amount", "amount", "transaction.amount"]);
      const amountFromPayload = amountCents != null ? amountCents / 100 : null;
      const offerHash =
        pickString(payload, [
          "data.offer_hash",
          "data.offer.hash",
          "offer_hash",
          "offer.hash",
        ]) ??
        pickString(dep?.request_payload, ["offer_hash", "offer.hash", "data.offer_hash"]) ??
        null;
      return {
        id: l.id,
        created_at: l.created_at,
        provider: l.provider,
        event_id: l.event_id,
        provider_transaction_id: l.provider_transaction_id,
        signature_valid: l.signature_valid,
        processed: l.processed,
        processing_error: l.processing_error,
        payment_status: paymentStatus,
        amount: dep ? Number(dep.amount) : amountFromPayload,
        offer_hash: offerHash,
        user_id: dep?.user_id ?? null,
        user_name: dep ? usersById.get(dep.user_id) ?? null : null,
        deposit_id: dep?.id ?? null,
        deposit_status: dep?.status ?? null,
        balance_before: wt?.balance_before ?? null,
        balance_after: wt?.balance_after ?? null,
        raw_payload: payload,
      };
    });

    return { rows, total: count ?? rows.length };
  });
