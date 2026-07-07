import type { ThemeId } from "@/game/config/themes";

export type MapDecor =
  | "clouds"
  | "lava"
  | "bubbles"
  | "stadium"
  | "candy"
  | "grid"
  | "snow"
  | "desert"
  | "stars"
  | "jungle";

export interface MapTheme {
  id: string;
  label: string;
  background: string;
  pole: string;
  platforms: [string, string, string];
  accent: string;
  ball: string;
  decorations: MapDecor;
  /** Best-effort mapping to an existing in-game ThemeId. */
  gameThemeId: ThemeId;
}

export const MAP_THEMES: MapTheme[] = [
  {
    id: "classic",
    label: "CLÁSSICO",
    background: "linear-gradient(180deg,#ffd1e5 0%,#ffe7d1 100%)",
    pole: "#7a0034",
    platforms: ["#d46a9c", "#c05284", "#f2a3c4"],
    accent: "#a855f7",
    ball: "#ffffff",
    decorations: "clouds",
    gameThemeId: "cotton",
  },
  {
    id: "inferno",
    label: "DARK INFERNO",
    background: "linear-gradient(180deg,#1a0505 0%,#5a1a0a 100%)",
    pole: "#2a0a0a",
    platforms: ["#ff3a1a", "#c02010", "#ffb84d"],
    accent: "#ff5a1a",
    ball: "#ffd28a",
    decorations: "lava",
    gameThemeId: "lava",
  },
  {
    id: "ocean",
    label: "OCEANO",
    background: "linear-gradient(180deg,#0a2a5a 0%,#1e6b8a 100%)",
    pole: "#08324a",
    platforms: ["#20c4d4", "#0e8fa8", "#a8f0ff"],
    accent: "#4de8ff",
    ball: "#ffffff",
    decorations: "bubbles",
    gameThemeId: "ocean",
  },
  {
    id: "futebol",
    label: "FUTEBOL",
    background: "linear-gradient(180deg,#0a3a1a 0%,#1a6b2a 100%)",
    pole: "#08201a",
    platforms: ["#22c55e", "#16803a", "#a7f3c9"],
    accent: "#22ff88",
    ball: "#ffffff",
    decorations: "stadium",
    gameThemeId: "cyber",
  },
  {
    id: "doce",
    label: "DOCE",
    background: "linear-gradient(180deg,#ffb3f7 0%,#b3e5ff 100%)",
    pole: "#ff5cb3",
    platforms: ["#a066ff", "#ff5cb3", "#fff066"],
    accent: "#ff66d9",
    ball: "#ffffff",
    decorations: "candy",
    gameThemeId: "candy",
  },
  {
    id: "cyber",
    label: "NEON CYBER",
    background: "linear-gradient(180deg,#0a0a1f 0%,#1a0a3a 100%)",
    pole: "#3a1a6b",
    platforms: ["#7b2ff7", "#00f0ff", "#a066ff"],
    accent: "#00f0ff",
    ball: "#00f0ff",
    decorations: "grid",
    gameThemeId: "neon",
  },
  {
    id: "gelo",
    label: "GELO",
    background: "linear-gradient(180deg,#c8e8ff 0%,#6ba3c8 100%)",
    pole: "#2e6b8a",
    platforms: ["#b8d4e8", "#6ba3c8", "#ffffff"],
    accent: "#a8e0ff",
    ball: "#ffffff",
    decorations: "snow",
    gameThemeId: "ocean",
  },
  {
    id: "deserto",
    label: "DESERTO",
    background: "linear-gradient(180deg,#f7b26b 0%,#c05f2a 100%)",
    pole: "#6b3a2a",
    platforms: ["#e8a87c", "#c4654a", "#f7c68a"],
    accent: "#ffb347",
    ball: "#fff2c8",
    decorations: "desert",
    gameThemeId: "gold",
  },
  {
    id: "galaxia",
    label: "GALÁXIA",
    background: "linear-gradient(180deg,#0a0022 0%,#2a0a5a 100%)",
    pole: "#1a0a3a",
    platforms: ["#8b5cf6", "#c084fc", "#f0abfc"],
    accent: "#c084fc",
    ball: "#ffffff",
    decorations: "stars",
    gameThemeId: "neon",
  },
  {
    id: "selva",
    label: "SELVA",
    background: "linear-gradient(180deg,#1a3c2a 0%,#2d5a3d 100%)",
    pole: "#3a2a10",
    platforms: ["#5a8a5c", "#2d5a3d", "#a0c49d"],
    accent: "#a0c49d",
    ball: "#fff8d0",
    decorations: "jungle",
    gameThemeId: "luxury",
  },
];
