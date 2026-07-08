import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const withdrawInput = z.object({
  amount: z.number().int().positive(),
  pixKey: z.string().trim().min(3).max(120).optional(),
});

export const requestAffiliateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("affiliate_balance, total_received")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Perfil não encontrado.");

    const balance = profile.affiliate_balance ?? 0;
    if (data.amount > balance) {
      throw new Error("Saldo de afiliado insuficiente.");
    }

    const { data: withdrawal, error: insertError } = await supabase
      .from("affiliate_withdrawals")
      .insert({
        user_id: userId,
        amount: data.amount,
        pix_key: data.pixKey ?? null,
      })
      .select("id, amount, status, created_at")
      .single();
    if (insertError) throw new Error(insertError.message);

    const newBalance = balance - data.amount;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ affiliate_balance: newBalance })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);

    return {
      withdrawal,
      affiliateBalance: newBalance,
      totalReceived: profile.total_received ?? 0,
    };
  });
