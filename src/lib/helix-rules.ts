/**
 * Fonte única de verdade das regras Helix PIX.
 * Deve refletir EXATAMENTE `public.helix_payout_cents` no banco.
 */
export const HELIX_DEPOSIT_RULES: ReadonlyArray<{
  amount: number;
  payoutPerPlatform: number;
  amountCents: number;
  payoutCents: number;
}> = [
  { amount: 5,   payoutPerPlatform: 0.5, amountCents: 500,   payoutCents: 50 },
  { amount: 10,  payoutPerPlatform: 1,   amountCents: 1000,  payoutCents: 100 },
  { amount: 20,  payoutPerPlatform: 2,   amountCents: 2000,  payoutCents: 200 },
  { amount: 30,  payoutPerPlatform: 3,   amountCents: 3000,  payoutCents: 300 },
  { amount: 50,  payoutPerPlatform: 5,   amountCents: 5000,  payoutCents: 500 },
  { amount: 100, payoutPerPlatform: 10,  amountCents: 10000, payoutCents: 1000 },
] as const;

export const HELIX_ALLOWED_AMOUNTS: ReadonlySet<number> = new Set(
  HELIX_DEPOSIT_RULES.map((r) => r.amount),
);

export const HELIX_ALLOWED_AMOUNT_CENTS: ReadonlySet<number> = new Set(
  HELIX_DEPOSIT_RULES.map((r) => r.amountCents),
);

export function getExpectedPayoutCents(amountCents: number): number | null {
  const rule = HELIX_DEPOSIT_RULES.find((r) => r.amountCents === amountCents);
  return rule ? rule.payoutCents : null;
}

export function isAllowedDepositAmount(amount: number): boolean {
  return HELIX_ALLOWED_AMOUNTS.has(amount);
}
