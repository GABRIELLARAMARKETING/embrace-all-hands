import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";

export type HelixWithdrawalRules = {
  ok: true;
  has_deposit: boolean;
  reference_deposit_cents?: number;
  available_reward_cents: number;
  minimum_withdraw_cents: number | null;
  can_withdraw: boolean;
  missing_to_withdraw_cents: number | null;
  message?: string;
};

/** Backend-only source of truth for Helix withdrawal rules. */
export const getHelixWithdrawalRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HelixWithdrawalRules> => {
    const { data, error } = await context.supabase.rpc("helix_withdrawal_rules");
    if (error) throw new Error(error.message);
    return data as unknown as HelixWithdrawalRules;
  });

const requestInput = z.object({
  amountCents: z.number().int().positive(),
  pixKey: z.string().trim().min(3).max(120),
});

async function logWithdrawalAttempt(params: {
  userId: string;
  amountCents: number;
  pixKeyMasked: string;
  rules: HelixWithdrawalRules | null;
  result: "allowed" | "blocked" | "error";
  reason: string;
  withdrawalId?: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      ua = getRequestHeader("user-agent") ?? null;
    } catch {
      // outside request context
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: params.userId,
      action: `withdrawal_${params.result}`,
      entity_type: "helix_withdrawal",
      entity_id: params.withdrawalId ?? null,
      reason: params.reason,
      ip,
      user_agent: ua,
      new_value: {
        amount_cents: params.amountCents,
        pix_key_masked: params.pixKeyMasked,
        reference_deposit_cents: params.rules?.reference_deposit_cents ?? null,
        minimum_withdraw_cents: params.rules?.minimum_withdraw_cents ?? null,
        available_reward_cents: params.rules?.available_reward_cents ?? null,
        has_deposit: params.rules?.has_deposit ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] failed to log withdrawal attempt", e);
  }
}

function maskPix(key: string) {
  const k = key.trim();
  if (k.length <= 4) return "***";
  return `${k.slice(0, 2)}***${k.slice(-2)}`;
}

/**
 * Requests a Helix withdrawal, enforcing tier-based minimum server-side.
 * Every attempt (allowed/blocked/error) is written to audit_logs for traceability.
 */
export const requestHelixWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => requestInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pixKeyMasked = maskPix(data.pixKey);
    let rules: HelixWithdrawalRules | null = null;
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      ua = getRequestHeader("user-agent") ?? null;
    } catch {
      // outside request context
    }

    try {
      // Snapshot rules for audit / friendlier errors (does not gate the decision).
      const { data: rulesRaw } = await supabase.rpc("helix_withdrawal_rules");
      rules = (rulesRaw as unknown as HelixWithdrawalRules) ?? null;

      // Atomic RPC: row-locks the profile, re-validates eligibility, inserts the withdrawal,
      // debits balance and writes wallet_transactions in a single transaction. This is what
      // guarantees correctness under concurrent withdrawal requests.
      const { data: rpcRaw, error: rpcError } = await supabase.rpc(
        "helix_request_withdrawal_atomic",
        {
          _amount_cents: data.amountCents,
          _pix_key: data.pixKey,
          _request_ip: ip ?? undefined,
          _request_user_agent: ua ?? undefined,
        },
      );
      if (rpcError) throw new Error(rpcError.message);
      const result = rpcRaw as {
        ok: boolean;
        reason?: string;
        withdrawal_id?: string;
        amount_cents?: number;
        available_reward_cents?: number;
        minimum_withdraw_cents?: number;
        reference_deposit_cents?: number;
      };

      if (!result?.ok) {
        const reason = result?.reason ?? "unknown";
        await logWithdrawalAttempt({
          userId,
          amountCents: data.amountCents,
          pixKeyMasked,
          rules,
          result: "blocked",
          reason,
        });
        switch (reason) {
          case "demo_account":
            throw new Error("DEMO_BALANCE_NOT_WITHDRAWABLE: Contas demo não podem sacar.");
          case "no_confirmed_deposit":
            throw new Error("Faça um depósito confirmado antes de solicitar saque.");
          case "below_minimum": {
            const min = result.minimum_withdraw_cents ?? 0;
            const avail = result.available_reward_cents ?? 0;
            throw new Error(
              `Saque mínimo é R$ ${(min / 100).toFixed(2)}. Faltam R$ ${(Math.max(min - avail, 0) / 100).toFixed(2)}.`,
            );
          }
          case "insufficient_balance":
            throw new Error("Saldo insuficiente para esse valor.");
          case "invalid_amount":
          case "invalid_pix":
            throw new Error("Dados de saque inválidos.");
          default:
            throw new Error("Não foi possível processar o saque agora. Tente novamente.");
        }
      }

      const withdrawalId = result.withdrawal_id!;
      const amountReais = data.amountCents / 100;

      // Best-effort admin notification (outside the DB transaction).
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: notifyError } = await supabaseAdmin.from("admin_notifications").insert({
          type: "WITHDRAWAL_REQUESTED",
          severity: "warning",
          title: `Novo saque solicitado: R$ ${amountReais}`,
          message: `Usuário ${userId} solicitou saque Helix de R$ ${amountReais}.`,
          payload: {
            withdrawal_id: withdrawalId,
            user_id: userId,
            amount: amountReais,
            pix_key_masked: pixKeyMasked,
            source: "helix",
          },
        });
        if (notifyError) console.error("[helix-withdrawal] admin_notification error", notifyError);
      } catch (e) {
        console.error("[helix-withdrawal] admin_notification threw", e);
      }

      await logWithdrawalAttempt({
        userId,
        amountCents: data.amountCents,
        pixKeyMasked,
        rules,
        result: "allowed",
        reason: "withdrawal_created",
        withdrawalId,
      });

      return {
        withdrawal: {
          id: withdrawalId,
          amount: amountReais,
          status: "pending" as const,
          created_at: new Date().toISOString(),
        },
        availableRewardCents: result.available_reward_cents ?? 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        !message.startsWith("Faça um depósito") &&
        !message.startsWith("Saque mínimo") &&
        !message.startsWith("Saldo insuficiente") &&
        !message.startsWith("DEMO_BALANCE_NOT_WITHDRAWABLE") &&
        !message.startsWith("Dados de saque")
      ) {
        await logWithdrawalAttempt({
          userId,
          amountCents: data.amountCents,
          pixKeyMasked,
          rules,
          result: "error",
          reason: message.slice(0, 500),
        });
      }
      throw err;
    }
  });
