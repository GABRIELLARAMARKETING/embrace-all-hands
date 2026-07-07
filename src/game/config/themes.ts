export type ThemeId =
  | "cotton"
  | "neon"
  | "gold"
  | "ocean"
  | "candy"
  | "cyber"
  | "lava"
  | "luxury";

export interface Theme {
  id: ThemeId;
  name: string;
  bgGradient: string;
  tower: string;
  platformNormal: string;
  platformDanger: string;
  platformBonus: string;
  accent: string;
  particle: string;
  unlockCost: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  cotton: {
    id: "cotton",
    name: "Cotton Sky",
    bgGradient: "linear-gradient(180deg,#ffd1e5 0%,#ffe7d1 100%)",
    tower: "#c0326e",
    platformNormal: "#e57ba8",
    platformDanger: "#3a0a1a",
    platformBonus: "#ffd166",
    accent: "#ff4d94",
    particle: "#ffffff",
    unlockCost: 0,
  },
  neon: {
    id: "neon",
    name: "Neon Night",
    bgGradient: "linear-gradient(180deg,#0a0a1f 0%,#1a0a3a 100%)",
    tower: "#3a1a6b",
    platformNormal: "#7b2ff7",
    platformDanger: "#ff2a6d",
    platformBonus: "#00f0ff",
    accent: "#00f0ff",
    particle: "#a066ff",
    unlockCost: 300,
  },
  gold: {
    id: "gold",
    name: "Gold Rush",
    bgGradient: "linear-gradient(180deg,#3a2a0a 0%,#8a6a1a 100%)",
    tower: "#8a5a1a",
    platformNormal: "#f1c40f",
    platformDanger: "#3a1a0a",
    platformBonus: "#fff2a8",
    accent: "#ffd700",
    particle: "#ffe680",
    unlockCost: 500,
  },
  ocean: {
    id: "ocean",
    name: "Ocean Drop",
    bgGradient: "linear-gradient(180deg,#0a2a5a 0%,#1e6b8a 100%)",
    tower: "#08324a",
    platformNormal: "#20c4d4",
    platformDanger: "#0a0a1a",
    platformBonus: "#a8f0ff",
    accent: "#4de8ff",
    particle: "#a8e0ff",
    unlockCost: 400,
  },
  candy: {
    id: "candy",
    name: "Candy Helix",
    bgGradient: "linear-gradient(180deg,#ffb3f7 0%,#b3e5ff 100%)",
    tower: "#ff5cb3",
    platformNormal: "#a066ff",
    platformDanger: "#3a0a3a",
    platformBonus: "#fff066",
    accent: "#ff66d9",
    particle: "#ffffff",
    unlockCost: 350,
  },
  cyber: {
    id: "cyber",
    name: "Cyber Cash",
    bgGradient: "linear-gradient(180deg,#001510 0%,#003a2a 100%)",
    tower: "#0a3a2a",
    platformNormal: "#00ff9d",
    platformDanger: "#ff003a",
    platformBonus: "#00e5ff",
    accent: "#00ff9d",
    particle: "#00ff9d",
    unlockCost: 600,
  },
  lava: {
    id: "lava",
    name: "Lava Core",
    bgGradient: "linear-gradient(180deg,#1a0505 0%,#5a1a0a 100%)",
    tower: "#2a0a0a",
    platformNormal: "#3a1a1a",
    platformDanger: "#ff3a1a",
    platformBonus: "#ffb84d",
    accent: "#ff5a1a",
    particle: "#ff8a3a",
    unlockCost: 750,
  },
  luxury: {
    id: "luxury",
    name: "Luxury White",
    bgGradient: "linear-gradient(180deg,#f5f5f5 0%,#e0d8c8 100%)",
    tower: "#c0a868",
    platformNormal: "#f0eadf",
    platformDanger: "#2a2018",
    platformBonus: "#d4af37",
    accent: "#b8952a",
    particle: "#ffffff",
    unlockCost: 1000,
  },
};

export const THEME_LIST = Object.values(THEMES);
