import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HELIX_DEPOSIT_RULES, getExpectedPayoutCents } from "./helix-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type HelixRuleCheck = {
  amount: number;
  amountCents: number;
  expectedPayoutCents: number;
  actualPayoutCents: number | null;
  ok: boolean;
};

export type HelixAuditResult = {
  rules: HelixRuleCheck[];
  rulesAllOk: boolean;
  invalidDeposits: Array<{
    id: string;
    user_id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  sessionMismatches: Array<{
    id: string;
    deposit_id: string | null;
    deposit_amount: number | null;
    payout_per_platform_cents: number;
    expected_payout_cents: number | null;
    status: string;
    created_at: string;
  }>;
  checkedAt: string;
};

export const auditHelixPayoutRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HelixAuditResult> => {
    const { data: adm } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (!adm) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Confere cada valor oficial contra a função do banco.
    const rules: HelixRuleCheck[] = [];
    for (const rule of HELIX_DEPOSIT_RULES) {
      const { data, error } = await supabaseAdmin.rpc("helix_payout_cents", {
        _amount_cents: rule.amountCents,
      } as any);
      rules.push({
        amount: rule.amount,
        amountCents: rule.amountCents,
        expectedPayoutCents: rule.payoutCents,
        actualPayoutCents: error ? null : (data as number | null),
        ok: !error && (data as number | null) === rule.payoutCents,
      });
    }
    const rulesAllOk = rules.every((r) => r.ok);

    // 2. Depósitos com valores fora da lista permitida (últimos 200).
    const allowed = HELIX_DEPOSIT_RULES.map((r) => r.amount);
    const { data: badDeps } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const invalidDeposits = (badDeps ?? [])
      .filter((d: any) => !allowed.includes(Number(d.amount)))
      .slice(0, 50)
      .map((d: any) => ({ ...d, amount: Number(d.amount) }));

    // 3. Sessões com payout_per_platform_cents divergente do esperado.
    const { data: sessions } = await supabaseAdmin
      .from("game_sessions")
      .select(
        "id, deposit_id, payout_per_platform_cents, status, created_at, deposits:deposit_id(amount)",
      )
      .not("deposit_id", "is", null)
      .gt("payout_per_platform_cents", 0)
      .order("created_at", { ascending: false })
      .limit(200);

    const sessionMismatches: HelixAuditResult["sessionMismatches"] = [];
    for (const s of (sessions ?? []) as any[]) {
      const depAmountReais = s.deposits?.amount != null ? Number(s.deposits.amount) : null;
      const depAmountCents = depAmountReais != null ? Math.round(depAmountReais * 100) : null;
      const expected = depAmountCents != null ? getExpectedPayoutCents(depAmountCents) : null;
      if (expected == null || s.payout_per_platform_cents !== expected) {
        sessionMismatches.push({
          id: s.id,
          deposit_id: s.deposit_id,
          deposit_amount: depAmountReais,
          payout_per_platform_cents: s.payout_per_platform_cents,
          expected_payout_cents: expected,
          status: s.status,
          created_at: s.created_at,
        });
      }
    }

    return {
      rules,
      rulesAllOk,
      invalidDeposits,
      sessionMismatches: sessionMismatches.slice(0, 50),
      checkedAt: new Date().toISOString(),
    };
  });
