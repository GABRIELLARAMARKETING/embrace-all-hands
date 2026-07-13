import { describe, expect, it } from "vitest";
import {
  getPayoutPerPlatform,
  calculateReward,
  HELIX_DEPOSIT_RULES,
} from "@/lib/helix-rules";

describe("helix-rules: getPayoutPerPlatform", () => {
  it.each([
    [500, 50],
    [1000, 100],
    [2000, 200],
    [3000, 300],
    [4375, 438],
    [5000, 500],
    [10000, 1000],
  ])("getPayoutPerPlatform(%i) === %i", (cents, expected) => {
    expect(getPayoutPerPlatform(cents)).toBe(expected);
  });

  it.each([0, -1, -500])(
    "rejeita valor inválido (%i)",
    (cents) => {
      expect(() => getPayoutPerPlatform(cents)).toThrow(/invalid/i);
    },
  );

  it("mantém paridade com a tabela HELIX_DEPOSIT_RULES", () => {
    for (const r of HELIX_DEPOSIT_RULES) {
      expect(getPayoutPerPlatform(r.amountCents)).toBe(r.payoutCents);
    }
  });
});

describe("helix-rules: calculateReward", () => {
  it.each([
    [10, 50, 500],
    [10, 100, 1000],
    [10, 200, 2000],
    [10, 300, 3000],
    [10, 500, 5000],
    [10, 1000, 10000],
    [0, 1000, 0],
    [1, 50, 50],
    [5, 200, 1000],
  ])("calculateReward(%i, %i) === %i cents", (n, payout, expected) => {
    expect(calculateReward(n, payout)).toBe(expected);
  });

  it("rejeita entradas inválidas", () => {
    expect(() => calculateReward(-1, 100)).toThrow();
    expect(() => calculateReward(1.5, 100)).toThrow();
    expect(() => calculateReward(1, -100)).toThrow();
    expect(() => calculateReward(1, 100.5)).toThrow();
  });

  it("reproduz cenários de aceite (10 plataformas → devolve o depósito)", () => {
    for (const r of HELIX_DEPOSIT_RULES) {
      expect(calculateReward(10, r.payoutCents)).toBe(r.amountCents);
    }
  });
});
