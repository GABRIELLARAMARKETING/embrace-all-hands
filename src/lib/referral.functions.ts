import { createServerFn } from "@tanstack/react-start";
import { noInput } from "@/lib/validation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReferralTier = "N1" | "N2" | "N3" | "TOTAL";
export interface ReferralStatsPayload {
  affiliateBalance: number;
  totalReceived: number;
  affiliateCode: string | null;
  referralUrl: string | null;
  stats: Record<ReferralTier, { count: number; deposits: number; subtitle: string }>;
}

function getPublicBaseUrl(): string {
  return (
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_APP_PUBLIC_URL ||
    "https://helixfast.lovable.app"
  ).replace(/\/$/, "");
}

export const getReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(noInput)
  .handler(async ({ context }): Promise<ReferralStatsPayload> => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("affiliate_balance, total_received, affiliate_code")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let affiliateCode = profile?.affiliate_code ?? null;

    // Garante que o usuário tenha um affiliate_code (trigger cobre novos users,
    // mas contas antigas podem não ter). Gera on-demand via RPC.
    if (!affiliateCode) {
      const { data: code } = await supabase.rpc("generate_affiliate_code" as never);
      if (code) {
        await supabase.from("profiles").update({ affiliate_code: code as string }).eq("id", userId);
        affiliateCode = code as string;
      }
    }

    // Agrega contagem por nível a partir de referrals
    const { data: refs } = await supabase
      .from("referrals")
      .select("referred_id, level")
      .eq("referrer_id", userId);

    const byLevel: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
    for (const r of (refs ?? []) as Array<{ referred_id: string; level: number }>) {
      if (r.level === 1 || r.level === 2 || r.level === 3) {
        byLevel[r.level].push(r.referred_id);
      }
    }
    const allIds = Array.from(new Set([...byLevel[1], ...byLevel[2], ...byLevel[3]]));

    // Soma depósitos aprovados/pagos por indicado
    const depositsByUser = new Map<string, number>();
    if (allIds.length) {
      const { data: deps } = await supabase
        .from("deposits")
        .select("user_id, amount, status")
        .in("user_id", allIds)
        .in("status", ["approved", "paid"]);
      for (const d of (deps ?? []) as Array<{ user_id: string; amount: number }>) {
        depositsByUser.set(d.user_id, (depositsByUser.get(d.user_id) ?? 0) + Number(d.amount ?? 0));
      }
    }
    const sumFor = (ids: string[]) => ids.reduce((acc, id) => acc + (depositsByUser.get(id) ?? 0), 0);

    const totalCount = allIds.length;
    const totalDeposits = sumFor(allIds);

    return {
      affiliateBalance: profile?.affiliate_balance ?? 0,
      totalReceived: profile?.total_received ?? 0,
      affiliateCode,
      referralUrl: affiliateCode ? `${getPublicBaseUrl()}/?ref=${affiliateCode}` : null,
      stats: {
        N1: { count: byLevel[1].length, deposits: sumFor(byLevel[1]), subtitle: "diretos" },
        N2: { count: byLevel[2].length, deposits: sumFor(byLevel[2]), subtitle: "2º nível" },
        N3: { count: byLevel[3].length, deposits: sumFor(byLevel[3]), subtitle: "3º nível" },
        TOTAL: { count: totalCount, deposits: totalDeposits, subtitle: "rede" },
      },
    };
  });
