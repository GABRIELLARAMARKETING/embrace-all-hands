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
    platformCount: Math.round(32 + progress * 38), // 32 → 70
    obstacleRate: Math.min(0.72, 0.3 + progress * 0.45), // 0.30 → 0.72
    gapSize: Math.max(1, 2 - Math.floor(progress * 1.5)), // 2 → 1
    gravityMult: 1.35 + progress * 0.85, // 1.35 → 2.2
    coinRate: 0.28 + progress * 0.15,
    theme: THEME_ROTATION[i % THEME_ROTATION.length],
  };
});
