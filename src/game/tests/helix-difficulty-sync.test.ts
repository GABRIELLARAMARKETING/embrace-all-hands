import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_HELIX_CONFIG,
  HELIX_DIFFICULTY_PRESETS,
  clampSettings,
  helixRuntime,
  settingsForDifficulty,
  type HelixDifficultyConfig,
} from "@/game/config/difficulty";

/**
 * Integração: simula o fluxo admin → banco → mobile.
 *
 * - `serverStore` representa a linha `platform_settings.helix_difficulty`.
 * - `saveFromAdmin` = server function `setHelixDifficulty`.
 * - `fetchOnMobile` = server function `getHelixDifficulty` (usado no boot/reload).
 * - `realtimePush` = evento `postgres_changes` recebido pelo hook
 *   `useHelixDifficultyLoader`, que empurra a nova config direto no runtime.
 *
 * Garante dois cenários:
 *   1) Mudança imediata (sem reload) — via realtime.
 *   2) Persistência após reload — via re-fetch no boot do jogo.
 */

let serverStore: HelixDifficultyConfig | null = null;

function saveFromAdmin(next: HelixDifficultyConfig): HelixDifficultyConfig {
  const settings =
    next.difficulty === "custom"
      ? clampSettings(next.settings)
      : settingsForDifficulty(next.difficulty);
  serverStore = { difficulty: next.difficulty, settings };
  return serverStore;
}

async function fetchOnMobile(): Promise<HelixDifficultyConfig> {
  return serverStore ?? DEFAULT_HELIX_CONFIG;
}

function realtimePush(row: HelixDifficultyConfig) {
  helixRuntime.set(row);
}

async function bootMobileGame() {
  const cfg = await fetchOnMobile();
  helixRuntime.set(cfg);
}

describe("helix difficulty sync (admin → mobile)", () => {
  beforeEach(() => {
    serverStore = null;
    helixRuntime.reset();
  });

  it("aplica imediatamente no mobile via realtime, sem reload", async () => {
    await bootMobileGame();
    expect(helixRuntime.get().difficulty).toBe("normal");

    // Admin publica "hard"
    const saved = saveFromAdmin({
      difficulty: "hard",
      settings: HELIX_DIFFICULTY_PRESETS.hard,
    });

    // Realtime empurra pro cliente
    let notified = 0;
    const unsub = helixRuntime.subscribe(() => notified++);
    realtimePush(saved);
    unsub();

    expect(notified).toBe(1);
    expect(helixRuntime.get().difficulty).toBe("hard");
    expect(helixRuntime.get().settings).toEqual(HELIX_DIFFICULTY_PRESETS.hard);
  });

  it("mantém a nova dificuldade após reload do jogo (re-fetch do banco)", async () => {
    saveFromAdmin({ difficulty: "extreme", settings: HELIX_DIFFICULTY_PRESETS.extreme });

    // Simula reload: runtime volta ao default e o boot re-busca do banco.
    helixRuntime.reset();
    expect(helixRuntime.get().difficulty).toBe("normal");

    await bootMobileGame();

    expect(helixRuntime.get().difficulty).toBe("extreme");
    expect(helixRuntime.get().settings).toEqual(HELIX_DIFFICULTY_PRESETS.extreme);
  });

  it("propaga custom settings (com clamp) tanto por realtime quanto por reload", async () => {
    const raw: HelixDifficultyConfig = {
      difficulty: "custom",
      settings: {
        ...HELIX_DIFFICULTY_PRESETS.normal,
        ballSpeed: 999, // fora do range → deve ser clampado
        gapSize: 0.5,
      },
    };
    const saved = saveFromAdmin(raw);
    expect(saved.settings.ballSpeed).toBeLessThanOrEqual(3.0);
    expect(saved.settings.gapSize).toBe(0.5);

    // Imediato via realtime
    realtimePush(saved);
    expect(helixRuntime.get().difficulty).toBe("custom");
    expect(helixRuntime.get().settings.ballSpeed).toBeLessThanOrEqual(3.0);

    // Após reload
    helixRuntime.reset();
    await bootMobileGame();
    expect(helixRuntime.get().difficulty).toBe("custom");
    expect(helixRuntime.get().settings.gapSize).toBe(0.5);
  });

  it("notifica assinantes (GameCanvas via useSyncExternalStore) a cada mudança", async () => {
    const seen: string[] = [];
    const unsub = helixRuntime.subscribe(() => seen.push(helixRuntime.get().difficulty));

    realtimePush(saveFromAdmin({ difficulty: "easy", settings: HELIX_DIFFICULTY_PRESETS.easy }));
    realtimePush(saveFromAdmin({ difficulty: "hard", settings: HELIX_DIFFICULTY_PRESETS.hard }));
    realtimePush(
      saveFromAdmin({ difficulty: "extreme", settings: HELIX_DIFFICULTY_PRESETS.extreme }),
    );

    unsub();
    expect(seen).toEqual(["easy", "hard", "extreme"]);
  });
});
