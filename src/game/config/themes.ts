import cottonBg from "@/assets/themes/cotton-bg.jpg.asset.json";
import neonBg from "@/assets/themes/neon-bg.jpg.asset.json";
import goldBg from "@/assets/themes/gold-bg.jpg.asset.json";
import oceanBg from "@/assets/themes/ocean-bg.jpg.asset.json";
import candyBg from "@/assets/themes/candy-bg.jpg.asset.json";
import cyberBg from "@/assets/themes/cyber-bg.jpg.asset.json";
import lavaBg from "@/assets/themes/lava-bg.jpg.asset.json";
import luxuryBg from "@/assets/themes/luxury-bg.jpg.asset.json";
import cottonCard from "@/assets/themes/cotton-card.jpg.asset.json";
import neonCard from "@/assets/themes/neon-card.jpg.asset.json";
import goldCard from "@/assets/themes/gold-card.jpg.asset.json";
import oceanCard from "@/assets/themes/ocean-card.jpg.asset.json";
import candyCard from "@/assets/themes/candy-card.jpg.asset.json";
import cyberCard from "@/assets/themes/cyber-card.jpg.asset.json";
import lavaCard from "@/assets/themes/lava-card.jpg.asset.json";
import luxuryCard from "@/assets/themes/luxury-card.jpg.asset.json";

export type ThemeId =
  | "cotton"
  | "neon"
  | "gold"
  | "ocean"
  | "candy"
  | "cyber"
  | "lava"
  | "luxury";

export interface ThemeBall {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  glowColor: string;
  trailColor: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  bgGradient: string;
  bgImage: string;
  cardImage: string;
  tower: string;
  platformNormal: string;
  platformDanger: string;
  platformBonus: string;
  accent: string;
  particle: string;
  unlockCost: number;
  ball: ThemeBall;
}

export const FALLBACK_BALL: ThemeBall = {
  color: "#ffffff",
  emissive: "#8b3dff",
  emissiveIntensity: 0.35,
  metalness: 0.25,
  roughness: 0.35,
  glowColor: "#8b3dff",
  trailColor: "#8b3dff",
};

export const THEMES: Record<ThemeId, Theme> = {
  cotton: {
    id: "cotton",
    name: "Cotton Sky",
    bgGradient: "linear-gradient(180deg,#ffd1e5 0%,#ffe7d1 100%)",
    bgImage: cottonBg.url,
    cardImage: cottonCard.url,
    tower: "#c0326e",
    platformNormal: "#e57ba8",
    platformDanger: "#3a0a1a",
    platformBonus: "#ffd166",
    accent: "#ff4d94",
    particle: "#ffffff",
    unlockCost: 0,
    ball: {
      color: "#ff66b3",
      emissive: "#c0326e",
      emissiveIntensity: 0.4,
      metalness: 0.2,
      roughness: 0.35,
      glowColor: "#ff4d94",
      trailColor: "#ff4d94",
    },
  },
  neon: {
    id: "neon",
    name: "Neon Night",
    bgGradient: "linear-gradient(180deg,#0a0a1f 0%,#1a0a3a 100%)",
    bgImage: neonBg.url,
    cardImage: neonCard.url,
    tower: "#3a1a6b",
    platformNormal: "#7b2ff7",
    platformDanger: "#ff2a6d",
    platformBonus: "#00f0ff",
    accent: "#00f0ff",
    particle: "#a066ff",
    unlockCost: 300,
    ball: {
      color: "#00f0ff",
      emissive: "#007bff",
      emissiveIntensity: 0.55,
      metalness: 0.5,
      roughness: 0.2,
      glowColor: "#00f0ff",
      trailColor: "#00f0ff",
    },
  },
  gold: {
    id: "gold",
    name: "Gold Rush",
    bgGradient: "linear-gradient(180deg,#3a2a0a 0%,#8a6a1a 100%)",
    bgImage: goldBg.url,
    cardImage: goldCard.url,
    tower: "#8a5a1a",
    platformNormal: "#f1c40f",
    platformDanger: "#e63946",
    platformBonus: "#fff2a8",
    accent: "#ffd700",
    particle: "#ffe680",
    unlockCost: 500,
    ball: {
      color: "#ffd700",
      emissive: "#a06a00",
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.18,
      glowColor: "#ffd700",
      trailColor: "#ffd700",
    },
  },
  ocean: {
    id: "ocean",
    name: "Ocean Drop",
    bgGradient: "linear-gradient(180deg,#0a2a5a 0%,#1e6b8a 100%)",
    bgImage: oceanBg.url,
    cardImage: oceanCard.url,
    tower: "#08324a",
    platformNormal: "#20c4d4",
    platformDanger: "#ff2d55",
    platformBonus: "#a8f0ff",
    accent: "#4de8ff",
    particle: "#a8e0ff",
    unlockCost: 400,
    ball: {
      color: "#a8e0ff",
      emissive: "#1a4a66",
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.15,
      glowColor: "#4de8ff",
      trailColor: "#4de8ff",
    },
  },
  candy: {
    id: "candy",
    name: "Candy Helix",
    bgGradient: "linear-gradient(180deg,#ffb3f7 0%,#b3e5ff 100%)",
    bgImage: candyBg.url,
    cardImage: candyCard.url,
    tower: "#ff5cb3",
    platformNormal: "#a066ff",
    platformDanger: "#3a0a3a",
    platformBonus: "#fff066",
    accent: "#ff66d9",
    particle: "#ffffff",
    unlockCost: 350,
    ball: {
      color: "#ff66d9",
      emissive: "#661a4a",
      emissiveIntensity: 0.45,
      metalness: 0.3,
      roughness: 0.3,
      glowColor: "#ff66d9",
      trailColor: "#ff66d9",
    },
  },
  cyber: {
    id: "cyber",
    name: "Cyber Cash",
    bgGradient: "linear-gradient(180deg,#001510 0%,#003a2a 100%)",
    bgImage: cyberBg.url,
    cardImage: cyberCard.url,
    tower: "#0a3a2a",
    platformNormal: "#00ff9d",
    platformDanger: "#ff003a",
    platformBonus: "#00e5ff",
    accent: "#00ff9d",
    particle: "#00ff9d",
    unlockCost: 600,
    ball: {
      color: "#00e5ff",
      emissive: "#008a6a",
      emissiveIntensity: 0.55,
      metalness: 0.7,
      roughness: 0.2,
      glowColor: "#00e5ff",
      trailColor: "#00e5ff",
    },
  },
  lava: {
    id: "lava",
    name: "Lava Core",
    bgGradient: "linear-gradient(180deg,#1a0505 0%,#5a1a0a 100%)",
    bgImage: lavaBg.url,
    cardImage: lavaCard.url,
    tower: "#2a0a0a",
    platformNormal: "#3a1a1a",
    platformDanger: "#ff3a1a",
    platformBonus: "#ffb84d",
    accent: "#ff5a1a",
    particle: "#ff8a3a",
    unlockCost: 750,
    ball: {
      // laranja quente, distinto do vermelho de perigo (#ff3a1a).
      color: "#ffb84d",
      emissive: "#8a3a00",
      emissiveIntensity: 0.6,
      metalness: 0.4,
      roughness: 0.3,
      glowColor: "#ffb84d",
      trailColor: "#ffb84d",
    },
  },
  luxury: {
    id: "luxury",
    name: "Luxury White",
    bgGradient: "linear-gradient(180deg,#f5f5f5 0%,#e0d8c8 100%)",
    bgImage: luxuryBg.url,
    cardImage: luxuryCard.url,
    tower: "#c0a868",
    platformNormal: "#f0eadf",
    platformDanger: "#2a2018",
    platformBonus: "#d4af37",
    accent: "#b8952a",
    particle: "#ffffff",
    unlockCost: 1000,
    ball: {
      color: "#d4af37",
      emissive: "#5a4010",
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.2,
      glowColor: "#d4af37",
      trailColor: "#d4af37",
    },
  },
};

export const THEME_LIST = Object.values(THEMES);

export function getBallTheme(themeId?: ThemeId): ThemeBall {
  if (themeId && THEMES[themeId]) return THEMES[themeId].ball;
  return FALLBACK_BALL;
}
