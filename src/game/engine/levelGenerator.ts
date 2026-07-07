import { CONSTANTS } from "@/game/config/constants";
import { seededRandom } from "@/utils/random";

export interface RingData {
  y: number;
  rotation: number; // base rotation offset for the ring
  sectors: SectorType[]; // length = SECTORS_PER_RING
  hasCoin: boolean;
  coinAngle: number;
}

export type SectorType = "solid" | "danger" | "bonus" | "empty";

export interface GeneratedLevel {
  rings: RingData[];
  totalHeight: number;
  gravity: number;
}

export function generateLevel(
  levelId: number,
  platformCount: number,
  obstacleRate: number,
  gapSize: number,
  gravityMult: number,
  coinRate: number,
): GeneratedLevel {
  const rnd = seededRandom(levelId * 9973 + 17);
  const rings: RingData[] = [];
  const S = CONSTANTS.SECTORS_PER_RING;

  for (let i = 0; i < platformCount; i++) {
    const sectors: SectorType[] = new Array(S).fill("solid");

    // Guarantee a passable gap: pick starting sector, mark `gapSize` sectors empty.
    const gapStart = Math.floor(rnd() * S);
    for (let g = 0; g < gapSize; g++) {
      sectors[(gapStart + g) % S] = "empty";
    }

    // Sprinkle danger sectors (never overwrite gap).
    for (let s = 0; s < S; s++) {
      if (sectors[s] === "empty") continue;
      if (rnd() < obstacleRate) sectors[s] = "danger";
    }

    // Bonus sectors disabled (yellow/reward wedges removed).

    const hasCoin = rnd() < coinRate;
    rings.push({
      y: -(i + 1) * CONSTANTS.PLATFORM_SPACING,
      rotation: rnd() * Math.PI * 2,
      sectors,
      hasCoin,
      coinAngle: rnd() * Math.PI * 2,
    });
  }

  return {
    rings,
    totalHeight: platformCount * CONSTANTS.PLATFORM_SPACING,
    gravity: CONSTANTS.GRAVITY * gravityMult,
  };
}
