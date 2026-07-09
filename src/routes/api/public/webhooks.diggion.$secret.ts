import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/webhooks/diggion/$secret
 *
 * Endpoint público (bypass auth) para receber postbacks da Diggion Pay.
 * Segurança:
 *  - Secret compartilhado no path bate com DIGGION_WEBHOOK_SECRET (env).
 *  - Payload bruto é sempre logado em payment_webhook_logs.
 *  - Antes de creditar, o service SEMPRE reconsulta a transação na API da Diggion
 *    (nunca confia no valor/status enviado pelo webhook).
 *  - Crédito é feito via RPC atômica credit_deposit_atomic (lock + idempotência).
 *  - Retorna sempre HTTP 200 após log para evitar reenvio infinito, exceto
 *    quando o secret é inválido (401) ou o payload é malformado (400).
 */
export const Route = createFileRoute("/api/public/webhooks/diggion/$secret")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const expected = process.env.DIGGION_WEBHOOK_SECRET;
        if (!expected) return new Response("misconfigured", { status: 500 });
        if (!params.secret || params.secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const rawBody = await request.text();
        let payload: any = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          // não logar authorization / cookies
          if (["authorization", "cookie", "set-cookie"].includes(k.toLowerCase())) return;
          headers[k] = v;
        });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { DiggionPayService } = await import("@/lib/diggion.server");

        // Extrai identificador da transação. Diggion pode enviar em diferentes
        // localizações; tentamos os mais comuns.
        const data = payload?.data ?? payload ?? {};
        const providerTxId: string | null =
          data?.hash || data?.transaction_hash || data?.transaction?.hash || data?.id || null;
        const eventId: string | null =
          payload?.event_id || payload?.id || (providerTxId ? `${providerTxId}:${data?.status ?? "unknown"}` : null);

        // 1. Log bruto (idempotente via event_id)
        const { data: existing } = await supabaseAdmin
          .from("payment_webhook_logs")
          .select("id, processed")
          .eq("provider", "diggion")
          .eq("event_id", eventId ?? "")
          .maybeSingle();

        if (existing?.processed) {
          return new Response("ok", { status: 200 });
        }

        const { data: logRow } = await supabaseAdmin
          .from("payment_webhook_logs")
          .insert({
            provider: "diggion",
            event_id: eventId,
            provider_transaction_id: providerTxId,
            headers: headers as any,
            payload: payload as any,
            signature_valid: true, // secret validado via path
          })
          .select("id")
          .single();

        if (!providerTxId) {
          await supabaseAdmin
            .from("payment_webhook_logs")
            .update({ processed: true, processing_error: "no provider tx id" })
            .eq("id", logRow!.id);
          return new Response("ok", { status: 200 });
        }

        // 2. Consulta ativa: SEMPRE reconsulta na API antes de creditar
        try {
          const tx = await DiggionPayService.getTransaction(providerTxId);
          const normalized = DiggionPayService.normalizeStatus(tx.status);

          // Localiza depósito interno
          const { data: dep } = await supabaseAdmin
            .from("deposits")
            .select("id, amount, status")
            .eq("provider", "diggion")
            .eq("external_id", providerTxId)
            .maybeSingle();

          if (!dep) {
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true, processing_error: "deposit not found" })
              .eq("id", logRow!.id);
            return new Response("ok", { status: 200 });
          }

          // Anexa webhook_payload no depósito
          await supabaseAdmin
            .from("deposits")
            .update({ webhook_payload: payload as any })
            .eq("id", dep.id);

          if (normalized === "paid") {
            const expectedAmount = (tx.amount ?? Math.round(Number(dep.amount) * 100)) / 100;
            const { data: credited, error: credErr } = await supabaseAdmin.rpc(
              "credit_deposit_atomic",
              {
                _deposit_id: dep.id,
                _expected_amount: expectedAmount,
                _provider_tx_id: providerTxId,
              },
            );
            if (credErr) throw credErr;
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true, processing_error: (credited as any)?.ok ? null : (credited as any)?.reason ?? null })
              .eq("id", logRow!.id);
          } else if (["expired", "canceled", "refunded", "chargeback"].includes(normalized)) {
            await supabaseAdmin
              .from("deposits")
              .update({ status: normalized as any })
              .eq("id", dep.id);
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true })
              .eq("id", logRow!.id);
          } else {
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true, processing_error: `status=${tx.status}` })
              .eq("id", logRow!.id);
          }
        } catch (e: any) {
          await supabaseAdmin
            .from("payment_webhook_logs")
            .update({
              processed: false,
              processing_error: String(e?.message ?? e).slice(0, 500),
            })
            .eq("id", logRow!.id);
          // 200 mesmo assim para evitar reenvio infinito; reconcile pega depois
          return new Response("ok", { status: 200 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
