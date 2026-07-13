import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HELIX_ALLOWED_AMOUNTS } from "@/lib/helix-rules";

/**
 * Retorna um depósito confirmado que libera o jogo. O valor de entrada não
 * fica mais preso ao depósito: o usuário pode escolher qualquer valor suportado
 * que caiba no saldo atual.
 */
export const getPlayableDeposit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const balance = Number((profile as { balance?: number | string } | null)?.balance ?? 0);
    if (balance <= 0) {
      return { ok: false as const, reason: "insufficient_balance" as const, balance };
    }

    const { data: deps, error } = await supabase
      .from("deposits")
      .select("id, amount, paid_at, credited_at, status")
      .eq("user_id", userId)
      .in("status", ["paid", "approved", "spent"])
      .not("credited_at", "is", null)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) throw new Error(error.message);
    if (!deps || deps.length === 0) {
      return { ok: false as const, reason: "no_paid_deposit" as const };
    }

    const playable = deps.find(
      (d) => HELIX_ALLOWED_AMOUNTS.has(Number(d.amount)),
    );

    if (!playable) {
      return { ok: false as const, reason: "no_playable_deposit" as const };
    }

    return {
      ok: true as const,
      depositId: playable.id,
      amount: balance,
      balance,
      referenceDepositAmount: Number(playable.amount),
    };
  });

/**
 * Valida no backend que `amount` é suportado e cabe no saldo atual. O depósito
 * retornado é apenas a referência de crédito confirmado para liberar o jogo.
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    const balance = Number((profile as { balance?: number | string } | null)?.balance ?? 0);
    if (balance < data.amount) {
      return { ok: false as const, reason: "insufficient_balance" as const, balance };
    }

    const { data: deps, error } = await supabase
      .from("deposits")
      .select("id, amount")
      .eq("user_id", userId)
      .in("status", ["paid", "approved", "spent"])
      .not("credited_at", "is", null)
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const reference = (deps ?? []).find((d) => HELIX_ALLOWED_AMOUNTS.has(Number(d.amount)));
    if (!reference) {
      return { ok: false as const, reason: "no_playable_deposit" as const };
    }

    return { ok: true as const, depositId: reference.id, amount: data.amount, balance };
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

