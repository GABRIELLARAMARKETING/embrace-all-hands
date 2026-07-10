import { CONSTANTS } from "@/game/config/constants";
import { seededRandom } from "@/utils/random";
import type { RingData, SectorType } from "./levelGenerator";

/**
 * =====================================================================
 *  INFINITE PLATFORM SYSTEM (Helix Jump)
 * =====================================================================
 *
 *  Sem plataforma final, sem "fim de fase". Enquanto a bola desce,
 *  novos anéis (rings) são gerados abaixo dela; anéis muito acima da
 *  bola são reciclados via object pooling para manter memória constante.
 *
 *  IDs de anéis são absolutos (0, 1, 2, ...) e nunca reutilizados —
 *  isso mantém os conjuntos `broken/breaking` (indexados por id)
 *  válidos para toda a partida, mesmo após reciclagem.
 *
 *  Onde ajustar o gameplay:
 *   - RINGS_AHEAD:  quantos anéis mantemos abaixo da bola (segurança).
 *   - RECYCLE_ABOVE: quantos anéis mantemos acima da bola antes de
 *                    liberar o slot para a pool.
 *   - difficultyForDepth(): rampa de dificuldade por profundidade.
 * =====================================================================
 */

const S = CONSTANTS.SECTORS_PER_RING;

/** Anéis sempre spawnados abaixo da bola. Suficiente p/ um scroll ~5s. */
export const RINGS_AHEAD = 28;
/** Anéis mantidos acima da bola antes de serem reciclados. */
export const RECYCLE_ABOVE = 6;

export interface InfiniteParams {
  levelSeed: number;
  baseObstacleRate: number;
  baseGapSize: number;
  baseCoinRate: number;
  // Multiplicadores vindos do painel admin (Helix runtime config).
  hxObstacleDensity: number;
  hxObstacleFrequency: number;
  hxGapSize: number;
  hxDifficultyProgressionRate: number;
}

/**
 * Rampa de dificuldade baseada na profundidade (id do anel).
 * - Chance de setor perigoso cresce até saturar em ~0.85.
 * - Tamanho da passagem (gap) diminui lentamente conforme profundidade.
 * - Multiplicador do admin (`hxDifficultyProgressionRate`) controla a rampa.
 *
 * Depth: id 0 ≈ base; id 200 ≈ ~2x mais denso (respeitando ProgressionRate).
 */
function difficultyForDepth(id: number, p: InfiniteParams) {
  const depthFactor =
    1 + Math.min(1.5, id / 120) * Math.max(0.1, p.hxDifficultyProgressionRate);

  const obstacleRate = Math.min(
    0.85,
    Math.max(
      0,
      p.baseObstacleRate *
        p.hxObstacleDensity *
        (0.6 + 0.4 * p.hxObstacleFrequency) *
        depthFactor,
    ),
  );

  // Gap encolhe conforme a torre fica perigosa (mínimo = 1 setor).
  const gapSize = Math.max(
    1,
    Math.round((p.baseGapSize * p.hxGapSize) / Math.max(1, depthFactor * 0.6)),
  );

  return { obstacleRate, gapSize, coinRate: p.baseCoinRate };
}

/**
 * Constrói UM anel no id absoluto informado. Determinístico por (seed, id):
 * o mesmo id sempre produz o mesmo layout — útil para replays/debug.
 */
export function buildRing(id: number, p: InfiniteParams): RingData {
  const rnd = seededRandom(p.levelSeed * 9973 + id * 131 + 17);
  const { obstacleRate, gapSize, coinRate } = difficultyForDepth(id, p);

  const sectors: SectorType[] = new Array(S).fill("solid");

  // Passagem segura garantida.
  const gapStart = Math.floor(rnd() * S);
  for (let g = 0; g < gapSize; g++) sectors[(gapStart + g) % S] = "empty";

  // Sprinkles perigosos (nunca sobrescreve o gap).
  for (let s = 0; s < S; s++) {
    if (sectors[s] === "empty") continue;
    if (rnd() < obstacleRate) sectors[s] = "danger";
  }

  return {
    y: -(id + 1) * CONSTANTS.PLATFORM_SPACING,
    rotation: rnd() * Math.PI * 2,
    sectors,
    hasCoin: rnd() < coinRate,
    coinAngle: rnd() * Math.PI * 2,
  };
}

/**
 * Gerenciador da pool infinita. Densamente indexado por id absoluto.
 *
 * - `rings[id]`      : dados do anel (pode ser `undefined` após reciclagem).
 * - `firstAliveIdx`  : ponteiro do primeiro anel ainda vivo (evita loops O(N)
 *                      sobre milhares de anéis já reciclados).
 * - `changed`        : marca se algo mudou nesse tick — o consumidor pode
 *                      forçar re-render de React apenas quando necessário.
 */
export class InfinitePlatformManager {
  rings: (RingData | undefined)[] = [];
  firstAliveIdx = 0;
  params: InfiniteParams;

  constructor(params: InfiniteParams, initialCount = RINGS_AHEAD * 2) {
    this.params = params;
    for (let i = 0; i < initialCount; i++) {
      this.rings.push(buildRing(i, params));
    }
  }

  /** Chame uma vez por frame com o Y atual da bola. */
  update(ballY: number): boolean {
    const spacing = CONSTANTS.PLATFORM_SPACING;
    let changed = false;

    // ---- 1. Geração ADIANTE (sempre há RINGS_AHEAD abaixo da bola). ----
    const desiredLastId = Math.ceil(-ballY / spacing) + RINGS_AHEAD;
    while (this.rings.length <= desiredLastId) {
      this.rings.push(buildRing(this.rings.length, this.params));
      changed = true;
    }

    // ---- 2. Reciclagem ATRÁS (libera slots acima da bola). ----
    const recycleY = ballY + RECYCLE_ABOVE * spacing;
    while (
      this.firstAliveIdx < this.rings.length &&
      (this.rings[this.firstAliveIdx]?.y ?? -Infinity) > recycleY
    ) {
      // Libera a referência para GC — mantendo o slot no array (id estável).
      this.rings[this.firstAliveIdx] = undefined;
      this.firstAliveIdx++;
      changed = true;
    }

    return changed;
  }
}
