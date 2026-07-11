export interface MapOption {
  id: string;
  name: string;
  gradient: string;
}

export const PLAYER_MOCK = {
  userName: "HelixFast",
  userEmail: "ricardo350@demo.com",
  onlineUsers: 311,
  balance: 2390,
  affiliateBalance: 0,
  totalReceived: 0,
  matchesPlayed: 14,
  referralCode: "DMDU4E20",
  referralUrl: "https://helixfast.online/?ref=DMDU4E20",
  commissionPercent: 50,
  withdrawMin: 20,
  depositMin: 20,
  depositOptions: [10, 20, 30, 50, 100] as const,
  playOptions: [10, 20, 30, 50, 100] as const,
  pixMockCode:
    "00020126360014BR.GOV.BCB.PIX0114+55119999999995204000053039865405120.005802BR5910HelixMulti6009SaoPaulo62070503***6304ABCD",
  referralStats: {
    N1: { count: 0, deposits: 0, subtitle: "diretos" },
    N2: { count: 0, deposits: 0, subtitle: "2º nível" },
    N3: { count: 0, deposits: 0, subtitle: "3º nível" },
    TOTAL: { count: 0, deposits: 0, subtitle: "rede" },
  } as Record<"N1" | "N2" | "N3" | "TOTAL", { count: number; deposits: number; subtitle: string }>,
};

export const MAP_OPTIONS: MapOption[] = [
  { id: "classico", name: "Clássico", gradient: "linear-gradient(180deg,#f4b8c2,#8b3a5d)" },
  { id: "neon", name: "Neon Tower", gradient: "linear-gradient(180deg,#22d3ee,#5b21b6)" },
  { id: "jungle", name: "Jungle Spin", gradient: "linear-gradient(180deg,#84cc16,#065f46)" },
  { id: "ice", name: "Ice Drop", gradient: "linear-gradient(180deg,#e0f2fe,#1e3a8a)" },
  { id: "shadow", name: "Shadow Helix", gradient: "linear-gradient(180deg,#4b5563,#0f172a)" },
];

export const DEPOSIT_BADGES: Record<number, { label: string; tone: "min" | "hot" | "pop" | "bonus" }> = {
  10: { label: "MÍNIMO", tone: "min" },
  50: { label: "POPULAR", tone: "pop" },
  100: { label: "BÔNUS +100%", tone: "bonus" },
};
