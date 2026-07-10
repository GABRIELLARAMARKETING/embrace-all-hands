import { describe, expect, it } from "vitest";
import { runHelixAudit } from "@/lib/helix-audit-core";
import {
  HELIX_DEPOSIT_RULES,
  HELIX_ALLOWED_AMOUNTS,
  isAllowedDepositAmount,
  getExpectedPayoutCents,
} from "@/lib/helix-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Deposit = { id: string; user_id: string; amount: number; status: string; created_at: string };
type Session = {
  id: string;
  deposit_id: string | null;
  payout_per_platform_cents: number;
  status: string;
  created_at: string;
  deposits: { amount: number } | null;
};

/**
 * Client falso que imita a superfície do supabaseAdmin usada em runHelixAudit:
 * rpc("helix_payout_cents") + from("deposits"|"game_sessions") em query chain.
 */
function makeClient(opts: {
  payoutMap?: Partial<Record<number, number | null>>;
  deposits?: Deposit[];
  sessions?: Session[];
}) {
  const payoutMap = opts.payoutMap ?? {};
  const deposits = opts.deposits ?? [];
  const sessions = opts.sessions ?? [];

  const chain = (rows: any[]) => {
    const api: any = {
      select: () => api,
      order: () => api,
      limit: async () => ({ data: rows, error: null }),
      not: () => api,
      gt: () => api,
    };
    return api;
  };

  return {
    rpc: async (name: string, args: any) => {
      if (name === "helix_payout_cents") {
        const cents = args._amount_cents as number;
        const defaults: Record<number, number> = {
          500: 50,
          1000: 100,
          2000: 200,
          3000: 300,
          5000: 500,
          10000: 1000,
        };
        const val = cents in payoutMap ? payoutMap[cents] : defaults[cents] ?? null;
        return { data: val ?? null, error: null };
      }
      return { data: null, error: null };
    },
    from: (table: string) => {
      if (table === "deposits") return chain(deposits);
      if (table === "game_sessions") return chain(sessions);
      return chain([]);
    },
  };
}

describe("helix-rules helpers", () => {
  it.each([5, 10, 20, 30, 50, 100])("aceita valor permitido R$ %s", (v) => {
    expect(isAllowedDepositAmount(v)).toBe(true);
    expect(HELIX_ALLOWED_AMOUNTS.has(v)).toBe(true);
  });

  it.each([1, 3, 7, 15, 25, 40, 75, 200, 500, 0, -10])(
    "recusa valor não permitido R$ %s",
    (v) => {
      expect(isAllowedDepositAmount(v)).toBe(false);
    },
  );

  it("mapa payout casa com regras oficiais", () => {
    for (const r of HELIX_DEPOSIT_RULES) {
      expect(getExpectedPayoutCents(r.amountCents)).toBe(r.payoutCents);
      expect(r.payoutCents).toBe(r.amountCents / 10);
    }
  });

  it("retorna null para centavos fora do mapa", () => {
    expect(getExpectedPayoutCents(777)).toBeNull();
    expect(getExpectedPayoutCents(15000)).toBeNull();
  });
});

describe("runHelixAudit — regras oficiais", () => {
  it("marca todas as regras OK quando o banco retorna o payout correto", async () => {
    const result = await runHelixAudit(makeClient({}));
    expect(result.rulesAllOk).toBe(true);
    expect(result.rules).toHaveLength(6);
    for (const r of result.rules) {
      expect(r.ok).toBe(true);
      expect(r.actualPayoutCents).toBe(r.expectedPayoutCents);
    }
  });

  it("detecta divergência quando o banco retorna payout errado", async () => {
    // R$ 20 devolvendo 150c em vez de 200c
    const result = await runHelixAudit(makeClient({ payoutMap: { 2000: 150 } }));
    expect(result.rulesAllOk).toBe(false);
    const r20 = result.rules.find((r) => r.amountCents === 2000)!;
    expect(r20.ok).toBe(false);
    expect(r20.actualPayoutCents).toBe(150);
    expect(r20.expectedPayoutCents).toBe(200);
    // As demais continuam OK
    expect(result.rules.filter((r) => r.ok)).toHaveLength(5);
  });

  it("marca regra como divergente se o banco retornar NULL", async () => {
    const result = await runHelixAudit(makeClient({ payoutMap: { 500: null } }));
    const r5 = result.rules.find((r) => r.amountCents === 500)!;
    expect(r5.ok).toBe(false);
    expect(r5.actualPayoutCents).toBeNull();
    expect(result.rulesAllOk).toBe(false);
  });
});

describe("runHelixAudit — depósitos inválidos", () => {
  it("ignora depósitos com valores permitidos", async () => {
    const now = new Date().toISOString();
    const deposits: Deposit[] = HELIX_DEPOSIT_RULES.map((r, i) => ({
      id: `d${i}`,
      user_id: `u${i}`,
      amount: r.amount,
      status: "paid",
      created_at: now,
    }));
    const result = await runHelixAudit(makeClient({ deposits }));
    expect(result.invalidDeposits).toHaveLength(0);
  });

  it("lista depósitos com valores fora do mapa", async () => {
    const now = new Date().toISOString();
    const deposits: Deposit[] = [
      { id: "ok", user_id: "u1", amount: 10, status: "paid", created_at: now },
      { id: "bad1", user_id: "u2", amount: 7, status: "paid", created_at: now },
      { id: "bad2", user_id: "u3", amount: 25, status: "waiting_payment", created_at: now },
      { id: "bad3", user_id: "u4", amount: 999, status: "paid", created_at: now },
    ];
    const result = await runHelixAudit(makeClient({ deposits }));
    expect(result.invalidDeposits.map((d) => d.id).sort()).toEqual(["bad1", "bad2", "bad3"]);
    expect(result.invalidDeposits.every((d) => typeof d.amount === "number")).toBe(true);
  });

  it("limita listagem a 50 registros", async () => {
    const now = new Date().toISOString();
    const deposits: Deposit[] = Array.from({ length: 120 }, (_, i) => ({
      id: `bad${i}`,
      user_id: "u",
      amount: 13, // sempre inválido
      status: "paid",
      created_at: now,
    }));
    const result = await runHelixAudit(makeClient({ deposits }));
    expect(result.invalidDeposits).toHaveLength(50);
  });
});

describe("runHelixAudit — sessões com payout divergente", () => {
  const now = new Date().toISOString();
  const mkSession = (p: Partial<Session> & Pick<Session, "id" | "payout_per_platform_cents"> & {
    depositAmount: number;
  }): Session => ({
    deposit_id: `dep-${p.id}`,
    status: "active",
    created_at: now,
    deposits: { amount: p.depositAmount },
    ...p,
    payout_per_platform_cents: p.payout_per_platform_cents,
    id: p.id,
  });

  it("não sinaliza sessões consistentes com o depósito", async () => {
    const sessions: Session[] = HELIX_DEPOSIT_RULES.map((r, i) =>
      mkSession({
        id: `s${i}`,
        payout_per_platform_cents: r.payoutCents,
        depositAmount: r.amount,
      }),
    );
    const result = await runHelixAudit(makeClient({ sessions }));
    expect(result.sessionMismatches).toHaveLength(0);
  });

  it("detecta sessão em que payout ≠ payout esperado do depósito", async () => {
    const sessions: Session[] = [
      // R$ 20 → esperado 200c, gravou 300c
      mkSession({ id: "s1", payout_per_platform_cents: 300, depositAmount: 20 }),
      // R$ 50 → esperado 500c, gravou 500c (OK)
      mkSession({ id: "s2", payout_per_platform_cents: 500, depositAmount: 50 }),
      // R$ 5 → esperado 50c, gravou 100c
      mkSession({ id: "s3", payout_per_platform_cents: 100, depositAmount: 5 }),
    ];
    const result = await runHelixAudit(makeClient({ sessions }));
    const ids = result.sessionMismatches.map((s) => s.id).sort();
    expect(ids).toEqual(["s1", "s3"]);
    const s1 = result.sessionMismatches.find((s) => s.id === "s1")!;
    expect(s1.expected_payout_cents).toBe(200);
    expect(s1.payout_per_platform_cents).toBe(300);
    expect(s1.deposit_amount).toBe(20);
  });

  it("marca sessão vinculada a depósito de valor não permitido", async () => {
    const sessions: Session[] = [
      mkSession({ id: "weird", payout_per_platform_cents: 130, depositAmount: 13 }),
    ];
    const result = await runHelixAudit(makeClient({ sessions }));
    expect(result.sessionMismatches).toHaveLength(1);
    expect(result.sessionMismatches[0].expected_payout_cents).toBeNull();
  });
});
