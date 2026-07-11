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

    try {
      const { data: rulesRaw, error: rulesError } = await supabase.rpc("helix_withdrawal_rules");
      if (rulesError) throw new Error(rulesError.message);
      rules = rulesRaw as unknown as HelixWithdrawalRules;

      if ((rules as any).reason === "demo_account") {
        await logWithdrawalAttempt({ userId, amountCents: data.amountCents, pixKeyMasked, rules, result: "blocked", reason: "demo_account" });
        throw new Error("DEMO_BALANCE_NOT_WITHDRAWABLE: Contas demo não podem sacar.");
      }

      if (!rules.has_deposit || !rules.minimum_withdraw_cents) {
        const reason = "no_confirmed_deposit";
        await logWithdrawalAttempt({ userId, amountCents: data.amountCents, pixKeyMasked, rules, result: "blocked", reason });
        throw new Error("Faça um depósito confirmado antes de solicitar saque.");
      }

      if (data.amountCents < rules.minimum_withdraw_cents) {
        const reason = "below_minimum";
        await logWithdrawalAttempt({ userId, amountCents: data.amountCents, pixKeyMasked, rules, result: "blocked", reason });
        throw new Error(
          `Saque mínimo é R$ ${(rules.minimum_withdraw_cents / 100).toFixed(2)}. Faltam R$ ${((rules.minimum_withdraw_cents - rules.available_reward_cents) / 100).toFixed(2)}.`,
        );
      }

      if (data.amountCents > rules.available_reward_cents) {
        const reason = "insufficient_balance";
        await logWithdrawalAttempt({ userId, amountCents: data.amountCents, pixKeyMasked, rules, result: "blocked", reason });
        throw new Error("Saldo insuficiente para esse valor.");
      }

      const amountReais = data.amountCents / 100;

      const { data: withdrawal, error: insertError } = await supabase
        .from("affiliate_withdrawals")
        .insert({
          user_id: userId,
          amount: amountReais,
          pix_key: data.pixKey,
        })
        .select("id, amount, status, created_at")
        .single();
      if (insertError) throw new Error(insertError.message);

      const newBalanceReais = (rules.available_reward_cents - data.amountCents) / 100;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ balance: newBalanceReais })
        .eq("id", userId);
      if (updErr) throw new Error(updErr.message);

      await logWithdrawalAttempt({
        userId,
        amountCents: data.amountCents,
        pixKeyMasked,
        rules,
        result: "allowed",
        reason: "withdrawal_created",
        withdrawalId: withdrawal.id,
      });

      return { withdrawal, availableRewardCents: rules.available_reward_cents - data.amountCents };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Only log as "error" for unexpected failures (blocked cases already logged above).
      if (
        !message.startsWith("Faça um depósito") &&
        !message.startsWith("Saque mínimo") &&
        !message.startsWith("Saldo insuficiente")
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
