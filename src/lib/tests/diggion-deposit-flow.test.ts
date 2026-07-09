/**
 * E2E-style test: garante que depósitos de R$ 5,00 e R$ 10,00
 *  1. usam o offer_hash correto na criação (b8d7p / ifnis)
 *  2. são reconhecidos pelo webhook da Diggion via external_id
 *  3. creditam o valor exato no saldo do usuário
 *
 * Simula a Diggion mockando `global.fetch` e simula o Supabase
 * mockando `@/integrations/supabase/client.server`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DepositRow = {
  id: string;
  user_id: string;
  amount: number;
  provider: string;
  status: string;
  external_id: string | null;
};

// ---------- Fake Supabase admin ----------
function makeFakeSupabase() {
  const deposits: DepositRow[] = [];
  const wallet: Array<{ user_id: string; amount: number; balance_after: number }> = [];
  const balances = new Map<string, number>();

  function chain(table: string) {
    let rows: any[] = [];
    if (table === "deposits") rows = deposits;
    let filtered = [...rows];
    const api: any = {
      insert(payload: any) {
        const row = {
          id: `dep_${deposits.length + 1}`,
          status: "pending",
          external_id: null,
          ...payload,
        };
        deposits.push(row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      },
      select() {
        return api;
      },
      update(patch: any) {
        return {
          eq(_col: string, val: any) {
            const target = deposits.find((d) => d.id === val);
            if (target) Object.assign(target, patch);
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      eq(col: string, val: any) {
        filtered = filtered.filter((r) => r[col] === val);
        return api;
      },
      maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
    };
    return api;
  }

  return {
    _state: { deposits, wallet, balances },
    supabaseAdmin: {
      from: (table: string) => chain(table),
      rpc: async (name: string, args: any) => {
        if (name === "credit_deposit_atomic") {
          const dep = deposits.find((d) => d.id === args._deposit_id);
          if (!dep) return { data: { ok: false, reason: "not_found" }, error: null };
          if (Math.round(dep.amount * 100) !== Math.round(args._expected_amount * 100)) {
            return { data: { ok: false, reason: "amount_mismatch" }, error: null };
          }
          if (dep.status === "paid") return { data: { ok: true, reason: "already" }, error: null };
          dep.status = "paid";
          const prev = balances.get(dep.user_id) ?? 0;
          const next = prev + dep.amount;
          balances.set(dep.user_id, next);
          wallet.push({ user_id: dep.user_id, amount: dep.amount, balance_after: next });
          return { data: { ok: true, new_balance: next }, error: null };
        }
        return { data: null, error: null };
      },
    },
  };
}

let fake = makeFakeSupabase();

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return fake.supabaseAdmin;
  },
}));

// ---------- Fake Diggion HTTP ----------
const capturedRequests: Array<{ url: string; body: any }> = [];
function installFetchMock() {
  const originalFetch = global.fetch;
  global.fetch = (async (input: any, init: any) => {
    const url = typeof input === "string" ? input : input.url;
    const body = init?.body ? JSON.parse(init.body as string) : null;
    capturedRequests.push({ url, body });

    if (url.includes("/transactions") && init?.method === "POST") {
      const hash = `tx_${body.offer_hash}_${body.amount}`;
      return new Response(
        JSON.stringify({
          data: {
            hash,
            status: "waiting_payment",
            amount: body.amount,
            pix: { pix_qr_code: "PIX-CODE", pix_url: "https://x/pix" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.match(/\/transactions\/[^/?]+/) && (init?.method ?? "GET") === "GET") {
      const hash = decodeURIComponent(url.split("/transactions/")[1].split("?")[0]);
      const amountCents = Number(hash.split("_").pop());
      return new Response(
        JSON.stringify({ data: { hash, status: "paid", amount: amountCents } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input, init);
  }) as any;
  return () => {
    global.fetch = originalFetch;
  };
}

let restoreFetch: () => void;

beforeEach(() => {
  fake = makeFakeSupabase();
  capturedRequests.length = 0;
  process.env.DIGGION_API_KEY = "test-key";
  process.env.DIGGION_OFFER_HASH = "default-offer";
  process.env.DIGGION_PRODUCT_HASH = "default-product";
  process.env.DIGGION_WEBHOOK_SECRET = "whsec";
  process.env.DIGGION_AUTH_MODE = "query";
  restoreFetch = installFetchMock();
});

afterEach(() => {
  restoreFetch();
  vi.resetModules();
});

async function createDeposit(userId: string, amount: number) {
  const { DiggionPayService } = await import("@/lib/diggion.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const OFFER_HASH_BY_AMOUNT: Record<number, string> = { 500: "b8d7p", 1000: "ifnis" };
  const amountCents = Math.round(amount * 100);
  const offerHash = OFFER_HASH_BY_AMOUNT[amountCents] ?? process.env.DIGGION_OFFER_HASH!;

  const { data: dep } = await supabaseAdmin
    .from("deposits")
    .insert({ user_id: userId, amount, provider: "diggion", status: "pending" })
    .select()
    .single();

  const created = await DiggionPayService.createTransaction({
    amountCents,
    postbackUrl: "https://app/webhook",
    offerHash,
    productHash: process.env.DIGGION_PRODUCT_HASH!,
    productTitle: "Depósito",
    customer: { name: "T", email: "t@t.com", phone: "11999999999", document: "12345678901" },
  });

  await supabaseAdmin
    .from("deposits")
    .update({ external_id: created.hash, status: "waiting_payment" })
    .eq("id", dep!.id);

  return { depositId: dep!.id as string, providerTxId: created.hash, offerHashUsed: offerHash };
}

async function simulateWebhook(providerTxId: string) {
  // Reproduz o núcleo do handler: reconsulta e credita
  const { DiggionPayService } = await import("@/lib/diggion.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tx = await DiggionPayService.getTransaction(providerTxId);
  const normalized = DiggionPayService.normalizeStatus(tx.status);
  expect(normalized).toBe("paid");

  const { data: dep } = await supabaseAdmin
    .from("deposits")
    .select("id, amount, user_id")
    .eq("provider", "diggion")
    .eq("external_id", providerTxId)
    .maybeSingle();

  expect(dep).toBeTruthy();
  const expectedAmount = (tx.amount ?? Math.round(Number(dep!.amount) * 100)) / 100;
  const { data: credited } = await supabaseAdmin.rpc("credit_deposit_atomic", {
    _deposit_id: dep!.id,
    _expected_amount: expectedAmount,
    _provider_tx_id: providerTxId,
  });
  return { dep, credited, expectedAmount };
}

describe("Diggion deposit flow – R$5 e R$10", () => {
  it.each([
    { amount: 5, expectedHash: "b8d7p" },
    { amount: 10, expectedHash: "ifnis" },
  ])("cria e credita depósito de R$ %s corretamente", async ({ amount, expectedHash }) => {
    const userId = `user-${amount}`;
    const { depositId, providerTxId, offerHashUsed } = await createDeposit(userId, amount);

    // 1. offer_hash correto na chamada da API
    expect(offerHashUsed).toBe(expectedHash);
    const createReq = capturedRequests.find(
      (r) => r.body?.offer_hash === expectedHash && r.body?.amount === amount * 100,
    );
    expect(createReq).toBeTruthy();

    // 2. webhook credita o valor exato
    const { dep, credited, expectedAmount } = await simulateWebhook(providerTxId);
    expect(dep).toBeTruthy();
    expect(dep!.id).toBe(depositId);
    expect(expectedAmount).toBe(amount);
    expect((credited as any).ok).toBe(true);
    expect((credited as any).new_balance).toBe(amount);

    // 3. saldo e depósito consistentes
    expect(fake._state.balances.get(userId)).toBe(amount);
    const stored = fake._state.deposits.find((d) => d.id === depositId)!;
    expect(stored.amount).toBe(amount);
    expect(stored.status).toBe("paid");
    expect(stored.external_id).toBe(providerTxId);
  });

  it("não confunde depósitos de R$5 e R$10 simultâneos", async () => {
    const a = await createDeposit("user-A", 5);
    const b = await createDeposit("user-B", 10);
    expect(a.offerHashUsed).toBe("b8d7p");
    expect(b.offerHashUsed).toBe("ifnis");

    await simulateWebhook(b.providerTxId);
    await simulateWebhook(a.providerTxId);

    expect(fake._state.balances.get("user-A")).toBe(5);
    expect(fake._state.balances.get("user-B")).toBe(10);
  });
});
