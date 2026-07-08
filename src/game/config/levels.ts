import type { ThemeId } from "./themes";

export interface Level {
  id: number;
  name: string;
  platformCount: number;
  obstacleRate: number; // 0..1 fraction of sectors that are dangerous
  gapSize: number; // number of empty sectors per ring
  gravityMult: number;
  coinRate: number; // probability of a coin per ring
  theme: ThemeId;
}

const THEME_ROTATION: ThemeId[] = [
  "cotton",
  "cotton",
  "neon",
  "ocean",
  "candy",
  "gold",
  "cyber",
  "lava",
  "luxury",
];

export const LEVELS: Level[] = Array.from({ length: 20 }, (_, i) => {
  const id = i + 1;
  const progress = i / 19;
  return {
    id,
    name:
      id === 1
        ? "Primeira Queda"
        : id === 20
          ? "Torre Suprema"
          : `Nível ${id}`,
    platformCount: Math.round(36 + progress * 44), // 36 → 80 (torre mais longa)
    obstacleRate: Math.min(0.32, 0.12 + progress * 0.22), // perigo suave
    gapSize: Math.max(1, 2 - Math.floor(progress * 1.5)), // 2 → 1 (passagem apertada)
    gravityMult: 1.6 + progress * 1.1, // 1.6 → 2.7 (queda muito mais rápida)
    coinRate: 0.28 + progress * 0.15,
    theme: THEME_ROTATION[i % THEME_ROTATION.length],
  };
});
