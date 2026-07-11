import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProfilePayload {
  userId: string;
  displayName: string;
  email: string;
  balance: number;
  matchesPlayed: number;
  affiliateBalance: number;
  totalReceived: number;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfilePayload> => {
    const { supabase, userId, claims } = context;

    // Auto-encerra sessões abandonadas (usuário jogou e fechou sem finalizar):
    // debita o depósito como perda e zera o saldo jogável antes de responder.
    try {
      await supabase.rpc("helix_abandon_active_sessions", { _grace_seconds: 0 });
    } catch {
      /* não bloqueia o carregamento do perfil */
    }

    const [{ data: profile, error: profileError }, { count, error: countError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, balance, coins, affiliate_balance, total_received")
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
    return {
      userId,
      displayName: profile?.display_name ?? email.split("@")[0] ?? "Jogador",
      email,
      balance: Number(profile?.balance ?? profile?.coins ?? 0),
      matchesPlayed: count ?? 0,
      affiliateBalance: profile?.affiliate_balance ?? 0,
      totalReceived: profile?.total_received ?? 0,
    };
  });
