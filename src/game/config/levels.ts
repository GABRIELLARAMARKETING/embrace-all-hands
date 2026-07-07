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
    platformCount: Math.round(22 + progress * 28), // 22 → 50
    obstacleRate: Math.min(0.5, 0.12 + progress * 0.35),
    gapSize: Math.max(1, 3 - Math.floor(progress * 2)), // 3 → 1
    gravityMult: 1 + progress * 0.6,
    coinRate: 0.35 + progress * 0.2,
    theme: THEME_ROTATION[i % THEME_ROTATION.length],
  };
});
