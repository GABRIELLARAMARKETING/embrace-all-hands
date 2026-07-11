import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HELIX_ALLOWED_AMOUNTS } from "@/lib/helix-rules";

/**
 * Diagnóstico: retorna todos os depósitos pagos/creditados do usuário,
 * marca qual está "usado" (com game_session) e qual seria escolhido como
 * jogável — mesma regra de `getPlayableDeposit`.
 */
export const getPlayableDepositDebug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: deps, error } = await supabase
      .from("deposits")
      .select("id, amount, status, paid_at, credited_at, provider, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = (deps ?? []).map((d) => d.id);
    const { data: used } = ids.length
      ? await supabase
          .from("game_sessions")
          .select("deposit_id, id, status, created_at")
          .in("deposit_id", ids)
      : { data: [] as { deposit_id: string | null; id: string; status: string; created_at: string }[] };
    const usedMap = new Map<string, { session_id: string; status: string; created_at: string }>();
    for (const u of used ?? []) {
      if (u.deposit_id) usedMap.set(u.deposit_id, { session_id: u.id, status: u.status, created_at: u.created_at });
    }

    const rows = (deps ?? []).map((d) => {
      const amount = Number(d.amount);
      const isPaidStatus = d.status === "paid" || d.status === "approved";
      const isCredited = !!d.credited_at;
      const isAllowedAmount = HELIX_ALLOWED_AMOUNTS.has(amount);
      const usedBy = usedMap.get(d.id) ?? null;
      const isPlayable = isPaidStatus && isCredited && isAllowedAmount && !usedBy;
      return {
        id: d.id,
        amount,
        status: d.status,
        provider: d.provider,
        paid_at: d.paid_at,
        credited_at: d.credited_at,
        created_at: d.created_at,
        isPaidStatus,
        isCredited,
        isAllowedAmount,
        usedBy,
        isPlayable,
      };
    });

    // Mesma ordenação de getPlayableDeposit: paid_at desc, nulls last.
    const paidSorted = rows
      .filter((r) => r.isPaidStatus && r.isCredited)
      .sort((a, b) => {
        const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return tb - ta;
      });
    const chosen = paidSorted.find((r) => r.isPlayable) ?? null;

    return {
      ok: true as const,
      userId,
      allowedAmounts: Array.from(HELIX_ALLOWED_AMOUNTS),
      totalDeposits: rows.length,
      chosen: chosen
        ? { id: chosen.id, amount: chosen.amount, status: chosen.status }
        : null,
      reason: chosen
        ? "playable_deposit_found"
        : rows.length === 0
          ? "no_deposits"
          : paidSorted.length === 0
            ? "no_paid_credited_deposit"
            : "no_playable_deposit",
      deposits: rows,
    };
  });
