import { HELIX_DEPOSIT_RULES, getExpectedPayoutCents } from "./helix-rules";
import type { HelixAuditResult } from "./helix-audit.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Núcleo puro da auditoria — recebe qualquer client com API tipo Supabase
 * (rpc + from), para poder ser testado com mocks sem tocar `.server.ts`
 * ou middleware de autenticação.
 */
export async function runHelixAudit(client: any): Promise<HelixAuditResult> {
  const rules: HelixAuditResult["rules"] = [];
  for (const rule of HELIX_DEPOSIT_RULES) {
    const { data, error } = await client.rpc("helix_payout_cents", {
      _amount_cents: rule.amountCents,
    });
    rules.push({
      amount: rule.amount,
      amountCents: rule.amountCents,
      expectedPayoutCents: rule.payoutCents,
      actualPayoutCents: error ? null : (data as number | null),
      ok: !error && (data as number | null) === rule.payoutCents,
    });
  }
  const rulesAllOk = rules.every((r) => r.ok);

  const allowed = HELIX_DEPOSIT_RULES.map((r) => r.amount);
  const { data: badDeps } = await client
    .from("deposits")
    .select("id, user_id, amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const invalidDeposits = (badDeps ?? [])
    .filter((d: any) => !allowed.includes(Number(d.amount)))
    .slice(0, 50)
    .map((d: any) => ({ ...d, amount: Number(d.amount) }));

  const { data: sessions } = await client
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
}
