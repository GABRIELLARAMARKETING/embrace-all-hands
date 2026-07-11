import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ActionSchema = z.enum(["credit", "debit", "reset"]);

async function assertAdmin(supabase: ReturnType<typeof requireSupabaseAuth> extends never ? never : any, userId: string) {
  const [{ data: a }, { data: s }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!a && !s) throw new Error("forbidden");
}

// ------- Buscar usuários -------
export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) =>
    z.object({ query: z.string().trim().max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const q = data.query.trim();
    if (!q) return { users: [] as Array<Record<string, unknown>> };

    // Se parece UUID, busca exato por id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    let query = context.supabase
      .from("profiles")
      .select(
        "id, display_name, balance, status, affiliate_code, phone, cpf, created_at",
      )
      .limit(20);

    if (isUuid) {
      query = query.eq("id", q);
    } else {
      const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
      query = query.or(
        `display_name.ilike.${like},affiliate_code.ilike.${like},phone.ilike.${like},cpf.ilike.${like}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) return { users: [], error: error.message };
    return { users: rows ?? [] };
  });

// ------- Detalhes da carteira -------
export const adminGetWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select(
        "id, display_name, balance, status, affiliate_code, phone, cpf, created_at, is_influencer, is_demo",
      )
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) return { ok: false as const, reason: "user_not_found" as const };

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);

    const { data: totals } = await context.supabase
      .from("deposits")
      .select("amount")
      .eq("user_id", data.userId)
      .in("status", ["paid", "approved", "spent"]);
    const totalDeposited = (totals ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const { data: withdrawn } = await context.supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", data.userId)
      .eq("type", "withdraw");
    const totalWithdrawn = (withdrawn ?? []).reduce(
      (acc, r) => acc + Math.abs(Number(r.amount ?? 0)),
      0,
    );

    const { data: history } = await context.supabase.rpc(
      "admin_wallet_history",
      { _target_user_id: data.userId, _limit: 50 },
    );

    return {
      ok: true as const,
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      totals: { totalDeposited, totalWithdrawn },
      history: (history ?? { adjustments: [], transactions: [] }) as {
        ok?: boolean;
        adjustments: unknown[];
        transactions: unknown[];
      },
    };
  });

// ------- Ajustar saldo (credit/debit/reset) -------
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    action: "credit" | "debit" | "reset";
    amount?: number;
    reason: string;
    note?: string;
    idempotencyKey?: string;
    confirmation?: string;
  }) =>
    z
      .object({
        userId: z.string().uuid(),
        action: ActionSchema,
        amount: z.number().positive().max(1_000_000).optional(),
        reason: z.string().trim().min(3).max(500),
        note: z.string().trim().max(1000).optional(),
        idempotencyKey: z.string().trim().max(200).optional(),
        confirmation: z.string().trim().max(50).optional(),
      })
      .refine(
        (v) =>
          v.action === "reset" ? true : typeof v.amount === "number" && v.amount > 0,
        { message: "amount required for credit/debit" },
      )
      .refine((v) => (v.action === "reset" ? v.confirmation === "RESETAR SALDO" : true), {
        message: "confirmation required for reset",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    const { data: result, error } = await context.supabase.rpc(
      "admin_adjust_balance",
      {
        _target_user_id: data.userId,
        _action: data.action,
        _amount: data.amount ?? null,
        _reason: data.reason,
        _note: data.note ?? null,
        _idempotency_key: data.idempotencyKey ?? null,
        _ip: ip,
        _user_agent: userAgent,
        _confirmation: data.confirmation ?? null,
      },
    );
    if (error) return { ok: false as const, reason: error.message };
    return result as {
      ok: boolean;
      reason?: string;
      adjustment_id?: string;
      balance_before?: number;
      balance_after?: number;
      delta?: number;
    };
  });
