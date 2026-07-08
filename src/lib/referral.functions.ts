import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReferralTier = "N1" | "N2" | "N3" | "TOTAL";
export interface ReferralStatsPayload {
  affiliateBalance: number;
  totalReceived: number;
  stats: Record<ReferralTier, { count: number; deposits: number; subtitle: string }>;
}

export const getReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralStatsPayload> => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("affiliate_balance, total_received")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // TODO: aggregate real referral counts from a referrals table when available.
    return {
      affiliateBalance: profile?.affiliate_balance ?? 0,
      totalReceived: profile?.total_received ?? 0,
      stats: {
        N1: { count: 0, deposits: 0, subtitle: "diretos" },
        N2: { count: 0, deposits: 0, subtitle: "2º nível" },
        N3: { count: 0, deposits: 0, subtitle: "3º nível" },
        TOTAL: { count: 0, deposits: 0, subtitle: "rede" },
      },
    };
  });
