// Helix — configurações de dificuldade controladas pelo admin.
// Estrutura única de referência. Persistido em platform_settings (key = helix_difficulty).

export type HelixDifficulty = "easy" | "normal" | "hard" | "extreme" | "custom";

export interface HelixSettings {
  ballSpeed: number;
  towerRotationSpeed: number;
  obstacleDensity: number;
  obstacleFrequency: number;
  gapSize: number;
  gravity: number;
  scoreMultiplier: number;
  difficultyProgressionRate: number;
}

export interface HelixDifficultyConfig {
  difficulty: HelixDifficulty;
  settings: HelixSettings;
}

export const DEFAULT_HELIX_SETTINGS: HelixSettings = {
  ballSpeed: 1.0,
  towerRotationSpeed: 1.0,
  obstacleDensity: 0.35,
  obstacleFrequency: 1.0,
  gapSize: 1.0,
  gravity: 1.0,
  scoreMultiplier: 1.0,
  difficultyProgressionRate: 1.0,
};

export const DEFAULT_HELIX_CONFIG: HelixDifficultyConfig = {
  difficulty: "normal",
  settings: DEFAULT_HELIX_SETTINGS,
};

export const HELIX_DIFFICULTY_PRESETS: Record<Exclude<HelixDifficulty, "custom">, HelixSettings> = {
  easy: {
    ballSpeed: 0.75,
    towerRotationSpeed: 0.75,
    obstacleDensity: 0.2,
    obstacleFrequency: 0.7,
    gapSize: 1.25,
    gravity: 0.85,
    scoreMultiplier: 0.8,
    difficultyProgressionRate: 0.7,
  },
  normal: DEFAULT_HELIX_SETTINGS,
  hard: {
    ballSpeed: 1.25,
    towerRotationSpeed: 1.25,
    obstacleDensity: 0.5,
    obstacleFrequency: 1.25,
    gapSize: 0.85,
    gravity: 1.15,
    scoreMultiplier: 1.3,
    difficultyProgressionRate: 1.25,
  },
  extreme: {
    ballSpeed: 1.5,
    towerRotationSpeed: 1.6,
    obstacleDensity: 0.7,
    obstacleFrequency: 1.6,
    gapSize: 0.65,
    gravity: 1.35,
    scoreMultiplier: 1.75,
    difficultyProgressionRate: 1.6,
  },
};

export const HELIX_SETTINGS_RANGES: Record<keyof HelixSettings, [number, number]> = {
  ballSpeed: [0.5, 3.0],
  towerRotationSpeed: [0.5, 3.0],
  obstacleDensity: [0.0, 1.0],
  obstacleFrequency: [0.5, 3.0],
  gapSize: [0.4, 1.5],
  gravity: [0.5, 3.0],
  scoreMultiplier: [0.5, 5.0],
  difficultyProgressionRate: [0.5, 3.0],
};

export const HELIX_DIFFICULTIES: HelixDifficulty[] = [
  "easy",
  "normal",
  "hard",
  "extreme",
  "custom",
];

export const HELIX_DIFFICULTY_LABELS: Record<HelixDifficulty, string> = {
  easy: "Fácil",
  normal: "Normal",
  hard: "Difícil",
  extreme: "Extremo",
  custom: "Personalizado",
};

export const HELIX_SETTINGS_LABELS: Record<keyof HelixSettings, string> = {
  ballSpeed: "Velocidade da bola",
  towerRotationSpeed: "Velocidade de rotação",
  obstacleDensity: "Densidade de obstáculos",
  obstacleFrequency: "Frequência de obstáculos",
  gapSize: "Tamanho do espaço livre",
  gravity: "Gravidade",
  scoreMultiplier: "Multiplicador de pontos",
  difficultyProgressionRate: "Progressão da dificuldade",
};

export function clampSettings(input: Partial<HelixSettings>): HelixSettings {
  const out = { ...DEFAULT_HELIX_SETTINGS };
  (Object.keys(HELIX_SETTINGS_RANGES) as (keyof HelixSettings)[]).forEach((k) => {
    const [min, max] = HELIX_SETTINGS_RANGES[k];
    const v = Number(input[k] ?? DEFAULT_HELIX_SETTINGS[k]);
    out[k] = Math.min(max, Math.max(min, Number.isFinite(v) ? v : DEFAULT_HELIX_SETTINGS[k]));
  });
  return out;
}

export function settingsForDifficulty(d: HelixDifficulty, custom?: HelixSettings): HelixSettings {
  if (d === "custom") return clampSettings(custom ?? DEFAULT_HELIX_SETTINGS);
  return HELIX_DIFFICULTY_PRESETS[d];
}

// ---- Runtime singleton (client) ----
// Módulo compartilhado lido pelo GameCanvas e pela store. Atualizado pelo
// loader que consome a API pública (fallback seguro: DEFAULT).
let runtime: HelixDifficultyConfig = DEFAULT_HELIX_CONFIG;

export const helixRuntime = {
  get(): HelixDifficultyConfig {
    return runtime;
  },
  set(next: HelixDifficultyConfig) {
    runtime = {
      difficulty: next.difficulty,
      settings: clampSettings(next.settings),
    };
  },
  reset() {
    runtime = DEFAULT_HELIX_CONFIG;
  },
};
