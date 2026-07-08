import { createServerFn } from "@tanstack/react-start";

export type ReferralTier = "N1" | "N2" | "N3" | "TOTAL";
export interface ReferralStatsPayload {
  affiliateBalance: number;
  totalReceived: number;
  stats: Record<ReferralTier, { count: number; deposits: number; subtitle: string }>;
}

export const getReferralStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReferralStatsPayload> => {
    // TODO: replace with real affiliate/referral data source.
    return {
      affiliateBalance: 0,
      totalReceived: 0,
      stats: {
        N1: { count: 0, deposits: 0, subtitle: "diretos" },
        N2: { count: 0, deposits: 0, subtitle: "2º nível" },
        N3: { count: 0, deposits: 0, subtitle: "3º nível" },
        TOTAL: { count: 0, deposits: 0, subtitle: "rede" },
      },
    };
  },
);
