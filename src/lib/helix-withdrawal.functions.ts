import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/**
 * Requests a Helix withdrawal, enforcing tier-based minimum server-side.
 * Balance is stored in reais on `profiles.balance`; we validate/deduct in cents.
 */
export const requestHelixWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => requestInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rulesRaw, error: rulesError } = await supabase.rpc("helix_withdrawal_rules");
    if (rulesError) throw new Error(rulesError.message);
    const rules = rulesRaw as unknown as HelixWithdrawalRules;

    if (!rules.has_deposit || !rules.minimum_withdraw_cents) {
      throw new Error("Faça um depósito confirmado antes de solicitar saque.");
    }

    if (data.amountCents < rules.minimum_withdraw_cents) {
      throw new Error(
        `Saque mínimo é R$ ${(rules.minimum_withdraw_cents / 100).toFixed(2)}. Faltam R$ ${((rules.minimum_withdraw_cents - rules.available_reward_cents) / 100).toFixed(2)}.`,
      );
    }

    if (data.amountCents > rules.available_reward_cents) {
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

    // Debit balance atomically-ish (RLS + protect trigger; balance is not
    // in the protected column list on profiles).
    const newBalanceReais = (rules.available_reward_cents - data.amountCents) / 100;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ balance: newBalanceReais })
      .eq("id", userId);
    if (updErr) throw new Error(updErr.message);

    return { withdrawal, availableRewardCents: rules.available_reward_cents - data.amountCents };
  });
