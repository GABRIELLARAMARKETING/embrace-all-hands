/**
 * Diggion Pay gateway integration (server-only).
 *
 * Base URL: https://api.diggion.com.br/api/public/v1
 *
 * Auth: passa o api token via query string `?api_token=...` (padrão dos
 * gateways brasileiros que expõem `/api/public/v1`). Se sua conta usar
 * Bearer, defina DIGGION_AUTH_MODE=bearer que o service ajusta o header.
 *
 * Endpoints usados:
 *  - POST /transactions              -> criar cobrança
 *  - GET  /transactions/{hash}       -> consultar status
 */

const DEFAULT_BASE = "https://api.diggion.com.br/api/public/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export type DiggionCreateInput = {
  amountCents: number; // Diggion espera valor em centavos
  postbackUrl: string;
  offerHash: string;
  productHash: string;
  productTitle: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string; // CPF só dígitos
  };
  paymentMethod?: "pix" | "billet";
  expireInDays?: number;
  tracking?: Record<string, string>;
};

export type DiggionCreateResponse = {
  hash: string;
  status: string;
  pix?: {
    pix_qr_code?: string;
    pix_url?: string;
  };
  qr_code?: string;
  qr_code_url?: string;
  copy_paste?: string;
  checkout_url?: string;
  expires_at?: string;
  amount?: number;
  raw: unknown;
};

export type DiggionTxStatus = {
  hash: string;
  status: string; // paid, waiting_payment, refused, refunded, chargeback...
  amount?: number; // em centavos, conforme doc
  paid_at?: string | null;
  raw: unknown;
};

function getEnv() {
  const base = process.env.DIGGION_BASE_URL || DEFAULT_BASE;
  const apiKey = process.env.DIGGION_API_KEY;
  const secret = process.env.DIGGION_SECRET_KEY;
  const authMode = (process.env.DIGGION_AUTH_MODE || "query").toLowerCase(); // query | bearer
  if (!apiKey) {
    throw new Error("DIGGION_API_KEY not configured");
  }
  return { base, apiKey, secret, authMode };
}

function buildUrl(path: string, apiKey: string, authMode: string): string {
  const url = new URL(`${DEFAULT_BASE.replace(/\/$/, "")}${path}`.replace(DEFAULT_BASE, process.env.DIGGION_BASE_URL || DEFAULT_BASE));
  if (authMode === "query") url.searchParams.set("api_token", apiKey);
  return url.toString();
}

function buildHeaders(apiKey: string, authMode: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authMode === "bearer") h["Authorization"] = `Bearer ${apiKey}`;
  return h;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<{ status: number; body: T | any }>
{
  const controller = new AbortController();
  const timeoutMs = Number(process.env.DIGGION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    const text = await resp.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    return { status: resp.status, body };
  } finally {
    clearTimeout(t);
  }
}

export class DiggionPayService {
  static async createTransaction(input: DiggionCreateInput): Promise<DiggionCreateResponse> {
    const { apiKey, authMode } = getEnv();
    const url = buildUrl("/transactions", apiKey, authMode);
    const body = {
      amount: input.amountCents,
      offer_hash: input.offerHash,
      payment_method: input.paymentMethod || "pix",
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        phone_number: input.customer.phone,
        document: input.customer.document,
      },
      cart: [
        {
          product_hash: input.productHash,
          title: input.productTitle,
          cover: null,
          price: input.amountCents,
          quantity: 1,
          operation_type: 1,
          tangible: false,
        },
      ],
      expire_in_days: input.expireInDays ?? 1,
      transaction_origin: "api",
      tracking: input.tracking || {},
      postback_url: input.postbackUrl,
    };

    const { status, body: resp } = await fetchJson<any>(url, {
      method: "POST",
      headers: buildHeaders(apiKey, authMode),
      body: JSON.stringify(body),
    });

    if (status < 200 || status >= 300) {
      throw new Error(
        `Diggion create failed (${status}): ${typeof resp === "string" ? resp : JSON.stringify(resp)}`,
      );
    }

    const data = resp?.data ?? resp;
    const pix = data?.pix || {};
    return {
      hash: data?.hash || data?.token || data?.id,
      status: data?.status || "waiting_payment",
      pix,
      qr_code: pix?.pix_qr_code || data?.qr_code,
      qr_code_url: pix?.pix_url || data?.qr_code_url,
      copy_paste: pix?.pix_qr_code || data?.copy_paste || data?.pix_copy_paste,
      checkout_url: data?.checkout_url || data?.payment_url,
      expires_at: data?.expires_at || data?.expiration,
      amount: data?.amount,
      raw: resp,
    };
  }

  static async getTransaction(hash: string): Promise<DiggionTxStatus> {
    const { apiKey, authMode } = getEnv();
    const url = buildUrl(`/transactions/${encodeURIComponent(hash)}`, apiKey, authMode);
    const { status, body: resp } = await fetchJson<any>(url, {
      method: "GET",
      headers: buildHeaders(apiKey, authMode),
    });
    if (status < 200 || status >= 300) {
      throw new Error(
        `Diggion get failed (${status}): ${typeof resp === "string" ? resp : JSON.stringify(resp)}`,
      );
    }
    const data = resp?.data ?? resp;
    return {
      hash: data?.hash || hash,
      status: data?.status,
      amount: data?.amount,
      paid_at: data?.paid_at || null,
      raw: resp,
    };
  }

  /** Mapeia status oficial da Diggion para status interno */
  static normalizeStatus(providerStatus: string | undefined | null):
    | "waiting_payment"
    | "paid"
    | "expired"
    | "canceled"
    | "refunded"
    | "chargeback"
    | "failed"
    | "pending"
  {
    const s = String(providerStatus || "").toLowerCase();
    if (["paid", "approved", "authorized", "confirmed", "completed"].includes(s)) return "paid";
    if (["waiting_payment", "pending", "processing"].includes(s)) return "waiting_payment";
    if (["expired"].includes(s)) return "expired";
    if (["canceled", "cancelled", "refused", "denied"].includes(s)) return "canceled";
    if (["refunded"].includes(s)) return "refunded";
    if (["chargeback", "chargedback"].includes(s)) return "chargeback";
    return "pending";
  }
}
