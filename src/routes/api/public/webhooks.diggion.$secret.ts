import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * POST /api/public/webhooks/diggion/$secret
 *
 * Segurança em camadas:
 *  1. Secret compartilhado no path (bate com DIGGION_WEBHOOK_SECRET).
 *  2. Assinatura HMAC-SHA256 do corpo bruto conferida contra os headers
 *     `gateway-signature` | `x-diggion-signature` | `x-signature` (quando
 *     presentes). Em modo estrito (DIGGION_WEBHOOK_STRICT_SIGNATURE=true)
 *     a ausência/erro de assinatura rejeita a requisição.
 *  3. Reconsulta ativa da transação na API antes de creditar.
 *  4. Log bruto em payment_webhook_logs + trilha em audit_logs.
 *  5. Crédito idempotente via credit_deposit_atomic.
 */

function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    // aceita "sha256=..." ou hex puro
    const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(provided, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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

        // Coleta headers (sanitizados)
        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          if (["authorization", "cookie", "set-cookie"].includes(k.toLowerCase())) return;
          headers[k] = v;
        });
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          null;
        const userAgent = request.headers.get("user-agent") || null;

        // --- Validação de assinatura HMAC ---
        const signatureHeader =
          request.headers.get("gateway-signature") ||
          request.headers.get("x-diggion-signature") ||
          request.headers.get("x-signature") ||
          request.headers.get("signature");
        const strict = String(process.env.DIGGION_WEBHOOK_STRICT_SIGNATURE || "").toLowerCase() === "true";
        let signatureValid = false;
        let signatureError: string | null = null;
        if (signatureHeader) {
          signatureValid = verifyHmac(rawBody, signatureHeader, expected);
          if (!signatureValid) signatureError = "invalid_signature";
        } else {
          signatureError = "missing_signature";
          // path secret já foi validado; assinatura só é obrigatória em modo strict
          signatureValid = !strict;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // audit log auxiliar (best-effort)
        const audit = async (
          action: string,
          entityId: string | null,
          newValue: Record<string, unknown>,
          reason?: string | null,
        ) => {
          try {
            await supabaseAdmin.from("audit_logs").insert({
              action,
              entity_type: "diggion_webhook",
              entity_id: entityId,
              new_value: newValue as any,
              reason: reason ?? null,
              ip,
              user_agent: userAgent,
            });
          } catch {
            /* nunca quebra webhook */
          }
        };

        if (strict && !signatureValid) {
          await audit("webhook.signature_rejected", null, {
            headers,
            hasSignatureHeader: Boolean(signatureHeader),
            error: signatureError,
          }, signatureError);
          const { auditLog } = await import("@/lib/audit.functions");
          await auditLog(supabaseAdmin, {
            eventType: "PAYMENT_WEBHOOK_INVALID",
            module: "webhooks",
            severity: "critical",
            title: "Webhook Diggion rejeitado por assinatura inválida",
            message: signatureError ?? "invalid_signature",
            metadata: { ip, headers },
          });
          return new Response("invalid signature", { status: 401 });
        }

        let payload: any = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          await audit("webhook.bad_payload", null, { headers, rawBodySize: rawBody.length }, "invalid_json");
          return new Response("Bad payload", { status: 400 });
        }

        const { DiggionPayService } = await import("@/lib/diggion.server");

        const data = payload?.data ?? payload ?? {};
        const providerTxId: string | null =
          data?.hash || data?.transaction_hash || data?.transaction?.hash || data?.id || null;
        const statusForEvent: string | null =
          data?.payment_status || data?.status || data?.transaction_status || data?.current_status || null;
        const eventType: string | null = payload?.event || payload?.type || statusForEvent || null;
        const rawEventId = payload?.event_id || payload?.id || data?.event_id || data?.id || null;
        const eventId: string | null = providerTxId
          ? `${providerTxId}:${eventType ?? "transaction"}:${statusForEvent ?? "unknown"}:${rawEventId ?? "noid"}`
          : rawEventId
            ? `unknown:${eventType ?? "transaction"}:${statusForEvent ?? "unknown"}:${rawEventId}`
            : null;

        // 1. Log bruto (idempotente via event_id)
        const { data: existing } = await supabaseAdmin
          .from("payment_webhook_logs")
          .select("id, processed")
          .eq("provider", "diggion")
          .eq("event_id", eventId ?? "")
          .maybeSingle();

        if (existing?.processed) {
          await audit("webhook.duplicate", providerTxId, { eventId, eventType }, "already_processed");
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
            signature_valid: signatureValid,
          })
          .select("id")
          .single();

        await audit("webhook.received", providerTxId, {
          eventId,
          eventType,
          signatureValid,
          signaturePresent: Boolean(signatureHeader),
          logId: logRow?.id ?? null,
        }, signatureError);

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

          const { data: dep } = await supabaseAdmin
            .from("deposits")
            .select("id, amount, status, user_id")
            .eq("provider", "diggion")
            .eq("external_id", providerTxId)
            .maybeSingle();

          if (!dep) {
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true, processing_error: "deposit not found" })
              .eq("id", logRow!.id);
            await audit("webhook.deposit_not_found", providerTxId, { normalized, providerStatus: tx.status });
            return new Response("ok", { status: 200 });
          }

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
            const ok = (credited as any)?.ok === true;
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true, processing_error: ok ? null : (credited as any)?.reason ?? null })
              .eq("id", logRow!.id);
            await audit(ok ? "webhook.deposit_credited" : "webhook.credit_skipped", dep.id, {
              providerTxId,
              amount: expectedAmount,
              result: credited,
              userId: dep.user_id,
            }, ok ? null : (credited as any)?.reason ?? null);
            const { auditLog } = await import("@/lib/audit.functions");
            await auditLog(supabaseAdmin, {
              eventType: ok ? "DEPOSIT_PAID" : "DEPOSIT_CREDIT_SKIPPED",
              module: "deposits",
              severity: ok ? "success" : "warning",
              title: ok
                ? `Depósito confirmado (R$ ${expectedAmount.toFixed(2)})`
                : `Crédito de depósito ignorado: ${(credited as any)?.reason ?? "unknown"}`,
              metadata: { providerTxId, amount: expectedAmount },
              entityType: "deposit",
              entityId: dep.id,
              userId: dep.user_id,
            });
          } else if (["expired", "canceled", "refunded", "chargeback"].includes(normalized)) {
            await supabaseAdmin
              .from("deposits")
              .update({ status: normalized as any })
              .eq("id", dep.id);
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true })
              .eq("id", logRow!.id);
            await audit("webhook.deposit_status_changed", dep.id, {
              providerTxId,
              status: normalized,
              userId: dep.user_id,
            });
          } else {
            await supabaseAdmin
              .from("payment_webhook_logs")
              .update({ processed: true, processing_error: `status=${tx.status}` })
              .eq("id", logRow!.id);
            await audit("webhook.deposit_pending", dep.id, {
              providerTxId,
              providerStatus: tx.status,
              normalized,
            });
          }
        } catch (e: any) {
          const msg = String(e?.message ?? e).slice(0, 500);
          await supabaseAdmin
            .from("payment_webhook_logs")
            .update({ processed: false, processing_error: msg })
            .eq("id", logRow!.id);
          await audit("webhook.error", providerTxId, { message: msg }, "processing_error");
          return new Response("ok", { status: 200 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
