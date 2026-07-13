import { createServerFn } from "@tanstack/react-start";
import { noInput } from "@/lib/validation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProfilePayload {
  userId: string;
  displayName: string;
  email: string;
  balance: number;
  matchesPlayed: number;
  affiliateBalance: number;
  totalReceived: number;
  isDemo: boolean;
  demoBalance: number;
  roles: string[];
}


export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(noInput)
  .handler(async ({ context }): Promise<ProfilePayload> => {
    const { supabase, userId, claims } = context;

    try {
      await supabase.rpc("helix_abandon_active_sessions", { _grace_seconds: 0 });
    } catch {
      /* não bloqueia */
    }

    const [{ data: profile, error: profileError }, { count, error: countError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, balance, coins, affiliate_balance, total_received, is_demo, demo_balance" as any)
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("game_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

    if (profileError) throw new Error(profileError.message);
    if (countError) throw new Error(countError.message);

    const email = (claims as { email?: string } | null)?.email ?? "";
    const p = (profile ?? {}) as any;
    return {
      userId,
      displayName: p.display_name ?? email.split("@")[0] ?? "Jogador",
      email,
      balance: Number(p.balance ?? p.coins ?? 0),
      matchesPlayed: count ?? 0,
      affiliateBalance: p.affiliate_balance ?? 0,
      totalReceived: p.total_received ?? 0,
      isDemo: !!p.is_demo,
      demoBalance: Number(p.demo_balance ?? 0),
    };
  });
