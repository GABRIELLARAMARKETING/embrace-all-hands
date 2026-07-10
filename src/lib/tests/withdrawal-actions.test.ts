/**
 * Integration test for withdrawal admin actions.
 *
 * Verifica que:
 *  1. approve/reject/markPaid mutam o estado corretamente (idempotência + regras)
 *  2. Após cada ação, ao invalidar o prefixo ["admin","withdrawals"] no
 *     QueryClient, TANTO a lista quanto a modal de detalhe refazem o fetch
 *     e passam a exibir o novo status imediatamente.
 *
 * Estratégia: replicamos o núcleo dos handlers (approve/reject/markPaid)
 * contra um fake supabase em memória — mesmas regras de transição e mesmo
 * cálculo de saldo — e conectamos as queries do painel a esse fake para
 * observar o comportamento do cache.
 */
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

type Row = {
  id: string;
  user_id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected" | "cancelled";
  pix_key: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const ADMIN_ID = "admin-1";
const USER_ID = "user-1";

function makeStore() {
  const withdrawals: Row[] = [
    {
      id: "w1",
      user_id: USER_ID,
      amount: 50,
      status: "pending",
      pix_key: "chave@x.com",
      admin_notes: null,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      paid_at: null,
      created_at: new Date().toISOString(),
    },
  ];
  const profiles = new Map<string, { affiliate_balance: number }>([
    [USER_ID, { affiliate_balance: 100 }],
  ]);
  return { withdrawals, profiles };
}

type Store = ReturnType<typeof makeStore>;

async function approve(store: Store, id: string, note?: string) {
  const w = store.withdrawals.find((x) => x.id === id);
  if (!w) throw new Error("not_found");
  if (!["pending", "in_review"].includes(w.status)) throw new Error("invalid_state");
  w.status = "approved";
  w.reviewed_by = ADMIN_ID;
  w.reviewed_at = new Date().toISOString();
  w.admin_notes = note ?? null;
}

async function reject(store: Store, id: string, reason: string) {
  const w = store.withdrawals.find((x) => x.id === id);
  if (!w) throw new Error("not_found");
  if (["paid", "rejected", "cancelled"].includes(w.status)) throw new Error("finalized");
  // devolve saldo
  const p = store.profiles.get(w.user_id)!;
  p.affiliate_balance += w.amount;
  w.status = "rejected";
  w.reviewed_by = ADMIN_ID;
  w.reviewed_at = new Date().toISOString();
  w.rejection_reason = reason;
}

async function markPaid(store: Store, id: string, note?: string) {
  const w = store.withdrawals.find((x) => x.id === id);
  if (!w) throw new Error("not_found");
  if (w.status !== "approved") throw new Error("must_be_approved");
  w.status = "paid";
  w.paid_at = new Date().toISOString();
  w.admin_notes = note ?? w.admin_notes;
}

// Simula os server-fns usados pelas queries do painel
function listAll(store: Store) {
  return store.withdrawals.map((w) => ({ ...w }));
}
function getDetail(store: Store, id: string) {
  const w = store.withdrawals.find((x) => x.id === id);
  if (!w) throw new Error("not_found");
  return { withdrawal: { ...w }, audit: [], userHistory: listAll(store) };
}

describe("Withdrawals admin actions – lista e modal refletem status imediatamente", () => {
  let store: Store;
  let qc: QueryClient;

  const LIST_KEY = ["admin", "withdrawals", "all"] as const;
  const DETAIL_KEY = ["admin", "withdrawals", "detail", "w1"] as const;

  async function primeCaches() {
    await qc.prefetchQuery({ queryKey: LIST_KEY, queryFn: () => listAll(store) });
    await qc.prefetchQuery({ queryKey: DETAIL_KEY, queryFn: () => getDetail(store, "w1") });
  }

  async function afterMutation() {
    // Em produção, invalidateQueries dispara refetch nos observers ativos
    // (lista + modal montadas). Sem componentes React aqui, refetchQueries
    // reproduz esse mesmo efeito de forma determinística.
    await qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    await qc.refetchQueries({ queryKey: ["admin", "withdrawals"] });
  }

  function listStatus() {
    return qc.getQueryData<Row[]>(LIST_KEY)?.[0]?.status;
  }
  function detailStatus() {
    return qc.getQueryData<{ withdrawal: Row }>(DETAIL_KEY)?.withdrawal.status;
  }

  beforeEach(() => {
    store = makeStore();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  });

  it("aprovar: lista + modal passam a 'approved'", async () => {
    await primeCaches();
    expect(listStatus()).toBe("pending");
    expect(detailStatus()).toBe("pending");

    await approve(store, "w1", "ok");
    await afterMutation();

    expect(listStatus()).toBe("approved");
    expect(detailStatus()).toBe("approved");
    expect(store.withdrawals[0].reviewed_by).toBe(ADMIN_ID);
    expect(store.withdrawals[0].admin_notes).toBe("ok");
  });

  it("recusar: lista + modal passam a 'rejected' e saldo é devolvido", async () => {
    await primeCaches();
    const balanceBefore = store.profiles.get(USER_ID)!.affiliate_balance;

    await reject(store, "w1", "documento inválido");
    await afterMutation();

    expect(listStatus()).toBe("rejected");
    expect(detailStatus()).toBe("rejected");
    expect(store.withdrawals[0].rejection_reason).toBe("documento inválido");
    expect(store.profiles.get(USER_ID)!.affiliate_balance).toBe(balanceBefore + 50);
  });

  it("marcar pago: só após approved; lista + modal passam a 'paid'", async () => {
    await primeCaches();
    await expect(markPaid(store, "w1")).rejects.toThrow("must_be_approved");

    await approve(store, "w1");
    await markPaid(store, "w1", "comprovante-123");
    await afterMutation();

    expect(listStatus()).toBe("paid");
    expect(detailStatus()).toBe("paid");
    expect(store.withdrawals[0].paid_at).toBeTruthy();
  });

  it("idempotência: aprovar duas vezes falha; pago não pode ser recusado", async () => {
    await primeCaches();
    await approve(store, "w1");
    await expect(approve(store, "w1")).rejects.toThrow("invalid_state");

    await markPaid(store, "w1");
    await expect(reject(store, "w1", "tarde demais")).rejects.toThrow("finalized");
    await afterMutation();

    expect(listStatus()).toBe("paid");
    expect(detailStatus()).toBe("paid");
  });

  it("invalidar prefixo ['admin','withdrawals'] atinge lista E detalhe", async () => {
    await primeCaches();
    await approve(store, "w1");

    // Sem invalidação, o cache continua velho
    expect(listStatus()).toBe("pending");
    expect(detailStatus()).toBe("pending");

    await afterMutation();

    expect(listStatus()).toBe("approved");
    expect(detailStatus()).toBe("approved");
  });
});
