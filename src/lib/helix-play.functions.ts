import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HELIX_ALLOWED_AMOUNTS } from "@/lib/helix-rules";

/**
 * Retorna o depósito pago mais recente do usuário que ainda NÃO foi usado
 * em uma sessão (game_sessions.deposit_id). Fonte única de verdade do
 * valor de entrada em /app/jogar — a UI não pode escolher valor arbitrário.
 */
export const getPlayableDeposit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: deps, error } = await supabase
      .from("deposits")
      .select("id, amount, paid_at, credited_at, status")
      .eq("user_id", userId)
      .in("status", ["paid", "approved"])
      .not("credited_at", "is", null)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) throw new Error(error.message);
    if (!deps || deps.length === 0) {
      return { ok: false as const, reason: "no_paid_deposit" as const };
    }

    const ids = deps.map((d) => d.id);
    const { data: used } = await supabase
      .from("game_sessions")
      .select("deposit_id")
      .in("deposit_id", ids);
    const usedSet = new Set((used ?? []).map((u) => u.deposit_id as string));

    const playable = deps.find(
      (d) =>
        !usedSet.has(d.id) &&
        HELIX_ALLOWED_AMOUNTS.has(Number(d.amount)),
    );

    if (!playable) {
      return { ok: false as const, reason: "no_playable_deposit" as const };
    }

    return {
      ok: true as const,
      depositId: playable.id,
      amount: Number(playable.amount),
    };
  });

/**
 * Valida no backend que `amount` corresponde EXATAMENTE ao depósito
 * pago/creditado e ainda não usado do usuário. Retorna 4xx-like via `ok:false`.
 */
export const validatePlayValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ amount: z.number().positive() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!HELIX_ALLOWED_AMOUNTS.has(data.amount)) {
      return { ok: false as const, reason: "unsupported_amount" as const };
    }

    const { data: deps, error } = await supabase
      .from("deposits")
      .select("id, amount")
      .eq("user_id", userId)
      .in("status", ["paid", "approved"])
      .not("credited_at", "is", null);
    if (error) throw new Error(error.message);

    const candidates = (deps ?? []).filter(
      (d) => Number(d.amount) === data.amount,
    );
    if (candidates.length === 0) {
      return { ok: false as const, reason: "amount_mismatch" as const };
    }

    const { data: used } = await supabase
      .from("game_sessions")
      .select("deposit_id")
      .in(
        "deposit_id",
        candidates.map((c) => c.id),
      );
    const usedSet = new Set((used ?? []).map((u) => u.deposit_id as string));
    const free = candidates.find((c) => !usedSet.has(c.id));
    if (!free) {
      return { ok: false as const, reason: "deposit_already_used" as const };
    }

    return { ok: true as const, depositId: free.id, amount: data.amount };
  });

/**
 * Inicia uma partida em modo DEMO consumindo `demo_balance` como crédito.
 * Só funciona para contas com `is_demo=true`. Nunca toca saldo real nem cria depósito.
 */
export const startDemoSessionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      amount: z.number().positive(),
      themeId: z.string().uuid().nullable().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (!HELIX_ALLOWED_AMOUNTS.has(data.amount)) {
      return { ok: false as const, reason: "unsupported_amount" as const };
    }

    const { data: res, error } = await supabase.rpc("helix_create_demo_session", {
      _amount: data.amount,
      _theme_id: data.themeId ?? undefined,
    });
    if (error) return { ok: false as const, reason: error.message };

    const parsed = (res ?? {}) as {
      ok?: boolean;
      session_id?: string;
      reason?: string;
    };
    if (!parsed.ok || !parsed.session_id) {
      return { ok: false as const, reason: parsed.reason ?? "session_not_created" };
    }
    return { ok: true as const, sessionId: parsed.session_id, amount: data.amount };
  });

