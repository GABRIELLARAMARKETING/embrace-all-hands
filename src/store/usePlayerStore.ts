import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { PLAYER_MOCK, MAP_OPTIONS } from "@/data/playerMockData";

type ReferralTier = "N1" | "N2" | "N3" | "TOTAL";
export type ReferralStats = Record<ReferralTier, { count: number; deposits: number; subtitle: string }>;

interface PlayerState {
  referralStats: ReferralStats;
  selectedMapId: string;
  selectedPlayValue: number | null;
  setSelectedMap: (id: string) => void;
  setSelectedPlayValue: (v: number | null) => void;
  setReferralStats: (s: ReferralStats) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      referralStats: PLAYER_MOCK.referralStats,
      selectedMapId: MAP_OPTIONS[0].id,
      selectedPlayValue: null,
      setSelectedMap: (id) => set({ selectedMapId: id }),
      setSelectedPlayValue: (v) => set({ selectedPlayValue: v }),
      setReferralStats: (referralStats) => set({ referralStats }),
    }),
    {
      name: "helix:player:v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
      skipHydration: typeof window === "undefined",
    },
  ),
);
