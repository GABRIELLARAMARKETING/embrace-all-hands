export type SkinId =
  | "classic"
  | "gold"
  | "neon"
  | "candy"
  | "ocean"
  | "lava"
  | "diamond"
  | "cyber";

export interface Skin {
  id: SkinId;
  name: string;
  color: string;
  emissive: string;
  metalness: number;
  roughness: number;
  cost: number;
}

export const SKINS: Record<SkinId, Skin> = {
  classic: { id: "classic", name: "Classic", color: "#ffffff", emissive: "#000000", metalness: 0.2, roughness: 0.3, cost: 0 },
  gold: { id: "gold", name: "Gold Ball", color: "#ffd700", emissive: "#553300", metalness: 1, roughness: 0.15, cost: 200 },
  neon: { id: "neon", name: "Neon Orb", color: "#00f0ff", emissive: "#00a0cc", metalness: 0.5, roughness: 0.2, cost: 300 },
  candy: { id: "candy", name: "Candy Ball", color: "#ff66d9", emissive: "#661a4a", metalness: 0.3, roughness: 0.35, cost: 250 },
  ocean: { id: "ocean", name: "Ocean Pearl", color: "#a8e0ff", emissive: "#1a4a66", metalness: 0.6, roughness: 0.1, cost: 350 },
  lava: { id: "lava", name: "Lava Core", color: "#ff3a1a", emissive: "#8a1a0a", metalness: 0.4, roughness: 0.4, cost: 400 },
  diamond: { id: "diamond", name: "Diamond Drop", color: "#e0f7ff", emissive: "#88ccff", metalness: 1, roughness: 0.05, cost: 750 },
  cyber: { id: "cyber", name: "Cyber Pulse", color: "#00ff9d", emissive: "#008a4a", metalness: 0.7, roughness: 0.2, cost: 500 },
};

export const SKIN_LIST = Object.values(SKINS);
