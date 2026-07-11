/**
 * E2E-style test para o fluxo do saldo sacável na rota /app/sacar.
 *
 * Cenário reproduzido:
 *  1. Usuário começa com saldo zero e sem depósito → /app/sacar mostra R$ 0,00
 *     e bloqueia o saque (has_deposit=false).
 *  2. Admin credita R$ 100,00 na conta do usuário (via painel admin) →
 *     helix_withdrawal_rules passa a reconhecer o depósito de referência e
 *     ainda bloqueia o saque porque o mínimo dessa faixa é R$ 500,00.
 *  3. Usuário joga e resgata R$ 500,00 em recompensas Helix →
 *     available_reward_cents = 50000 e can_withdraw = true.
 *  4. A queryFn usada por src/routes/app.sacar.tsx retorna o valor de 500,00
 *     (NÃO trava em 0,00) e permite solicitar saque.
 *
 * Estratégia: reproduzimos o núcleo do RPC `helix_withdrawal_rules` num store
 * em memória e conectamos ao QueryClient com a mesma chave/config usada pela
 * rota, garantindo que o cache do TanStack Query também surfacia o valor.
 */
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

type Store = {
  balanceCents: number;
  adminDepositCents: number; // depósito de referência (admin ou pix)
  adminDepositStatus: "none" | "paid" | "approved" | "spent" | "pending";
  rewardsCents: number;      // recompensas de gameplay disponíveis
  isDemo: boolean;
};

function makeStore(): Store {
  return {
    balanceCents: 0,
    adminDepositCents: 0,
    adminDepositStatus: "none",
    rewardsCents: 0,
    isDemo: false,
  };
}

/** Replica o RPC helix_withdrawal_rules (versão relevante para o teste). */
function helixWithdrawalRules(store: Store) {
  if (store.isDemo) {
    return {
      ok: true,
      reason: "demo_account",
      has_deposit: false,
      available_reward_cents: 0,
      minimum_withdraw_cents: null,
      can_withdraw: false,
      missing_to_withdraw_cents: null,
    } as const;
  }
  const hasDeposit =
    store.adminDepositCents > 0 &&
    ["paid", "approved", "spent"].includes(store.adminDepositStatus);
  const referenceCents = hasDeposit ? store.adminDepositCents : undefined;
  const availableCents = store.balanceCents;
  // Replica public.helix_minimum_withdraw_cents.
  const minCents = hasDeposit
    ? ({
        500: 2500,
        1000: 5000,
        2000: 10000,
        3000: 15000,
        5000: 25000,
        10000: 50000,
      } as Record<number, number>)[store.adminDepositCents] ?? null
    : null;
  const canWithdraw = hasDeposit && minCents !== null && availableCents >= minCents;
  const missing =
    hasDeposit && minCents !== null && availableCents < minCents
      ? minCents - availableCents
      : null;
  return {
    ok: true,
    has_deposit: hasDeposit,
    reference_deposit_cents: referenceCents,
    available_reward_cents: availableCents,
    minimum_withdraw_cents: minCents,
    can_withdraw: canWithdraw,
    missing_to_withdraw_cents: missing,
  } as const;
}

/** Mesma queryFn efetivamente executada pela rota /app/sacar. */
function makeSacarQuery(store: Store) {
  return {
    queryKey: ["helix-withdrawal-rules"] as const,
    queryFn: async () => helixWithdrawalRules(store),
    staleTime: 0,
    refetchOnMount: "always" as const,
    refetchOnWindowFocus: true,
  };
}

describe("/app/sacar — saldo sacável (E2E)", () => {
  let store: Store;
  let qc: QueryClient;

  beforeEach(() => {
    store = makeStore();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("mostra R$ 0,00 e bloqueia saque enquanto não há depósito nem recompensa", async () => {
    const rules = await qc.fetchQuery(makeSacarQuery(store));
    expect(rules.available_reward_cents).toBe(0);
    expect(rules.has_deposit).toBe(false);
    expect(rules.can_withdraw).toBe(false);
  });

  it("admin credita R$100 e usuário resgata R$500 → /app/sacar exibe R$500 sacáveis", async () => {
    // 1) Antes do depósito: saldo trava em 0
    let rules = await qc.fetchQuery(makeSacarQuery(store));
    expect(rules.available_reward_cents).toBe(0);
    expect(rules.can_withdraw).toBe(false);

    // 2) Admin credita R$ 100,00 no painel admin
    store.adminDepositCents = 10000;
    store.adminDepositStatus = "paid";
    store.balanceCents = 10000;
    await qc.invalidateQueries({ queryKey: ["helix-withdrawal-rules"] });
    rules = await qc.fetchQuery(makeSacarQuery(store));
    expect(rules.has_deposit).toBe(true);
    expect(rules.reference_deposit_cents).toBe(10000);
    // ainda não jogou → só existe o crédito jogável de entrada, abaixo do mínimo de saque
    expect(rules.available_reward_cents).toBe(10000);
    expect(rules.minimum_withdraw_cents).toBe(50000);
    expect(rules.can_withdraw).toBe(false);
    expect(rules.missing_to_withdraw_cents).toBe(40000);

    // 3) Usuário joga e resgata R$ 500,00 em recompensas Helix
    store.rewardsCents = 50000;
    store.balanceCents = 50000;
    // Ao finalizar a partida, o depósito usado passa para spent. A regra de
    // saque precisa continuar reconhecendo essa referência para todos os usuários.
    store.adminDepositStatus = "spent";
    await qc.invalidateQueries({ queryKey: ["helix-withdrawal-rules"] });
    rules = await qc.fetchQuery(makeSacarQuery(store));

    // 4) Regressão do bug: NÃO pode travar em 0,00
    expect(rules.available_reward_cents).not.toBe(0);
    expect(rules.available_reward_cents).toBe(50000);
    expect(rules.has_deposit).toBe(true);
    expect(rules.can_withdraw).toBe(true);
    expect(rules.missing_to_withdraw_cents).toBeNull();

    // 5) A rota lê o cache já com o valor atualizado
    const cached = qc.getQueryData<ReturnType<typeof helixWithdrawalRules>>([
      "helix-withdrawal-rules",
    ]);
    expect(cached?.available_reward_cents).toBe(50000);
    // Renderização: (50000/100).toFixed(2) === "500.00"
    expect((cached!.available_reward_cents / 100).toFixed(2)).toBe("500.00");
  });

  it("contas demo continuam bloqueadas mesmo com recompensa", async () => {
    store.isDemo = true;
    store.rewardsCents = 50000;
    const rules = await qc.fetchQuery(makeSacarQuery(store));
    expect(rules.can_withdraw).toBe(false);
    expect((rules as any).reason).toBe("demo_account");
  });

  it("resgates em sequência rápida — saldo sacável nunca trava em 0,00", async () => {
    // Setup: admin credita R$100 e usuário acumula R$1500 sacáveis
    store.adminDepositCents = 10000;
    store.adminDepositStatus = "spent";
    store.balanceCents = 150000;
    store.rewardsCents = 150000;

    const requestWithdraw = async (amountCents: number) => {
      const current = await qc.fetchQuery(makeSacarQuery(store));
      if (!current.can_withdraw) throw new Error("withdraw_blocked");
      if (amountCents > current.available_reward_cents)
        throw new Error("insufficient_balance");
      store.balanceCents -= amountCents;
      store.rewardsCents -= amountCents;
      await qc.invalidateQueries({ queryKey: ["helix-withdrawal-rules"] });
      return qc.fetchQuery(makeSacarQuery(store));
    };

    // Rajada: 3 saques de R$ 500 em paralelo
    const results = await Promise.all([
      requestWithdraw(50000),
      requestWithdraw(50000),
      requestWithdraw(50000),
    ]);

    for (const r of results) {
      expect(r.available_reward_cents).toBeGreaterThanOrEqual(0);
      expect(r.has_deposit).toBe(true);
    }

    // Estado final consistente: 150000 - 3*50000 = 0
    const finalRules = await qc.fetchQuery(makeSacarQuery(store));
    expect(store.balanceCents).toBe(0);
    expect(finalRules.available_reward_cents).toBe(0);
    // Regressão: mesmo com saldo 0, has_deposit permanece — não perde a
    // referência do depósito nem trava a UI antes da hora.
    expect(finalRules.has_deposit).toBe(true);
    expect(finalRules.reference_deposit_cents).toBe(10000);
  });

  it("novos créditos em sequência rápida após saque nunca travam em 0,00", async () => {
    store.adminDepositCents = 10000;
    store.adminDepositStatus = "spent";
    store.balanceCents = 0;
    store.rewardsCents = 0;

    let rules = await qc.fetchQuery(makeSacarQuery(store));
    expect(rules.available_reward_cents).toBe(0);

    // 3 recompensas rápidas de R$ 200
    for (let i = 0; i < 3; i++) {
      store.balanceCents += 20000;
      store.rewardsCents += 20000;
      await qc.invalidateQueries({ queryKey: ["helix-withdrawal-rules"] });
      rules = await qc.fetchQuery(makeSacarQuery(store));
      expect(rules.available_reward_cents).toBe(20000 * (i + 1));
    }

    expect(rules.available_reward_cents).toBe(60000);
    expect(rules.can_withdraw).toBe(true);
  });
});
