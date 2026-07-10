import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store/useGameStore";
import {
  getSafeStorage,
  setSafeStorage,
  clearGameProgress,
  validateProgressData,
} from "@/utils/storage";

// Ensures the reward flow persists a totalCoins balance with NO upper cap
// and that a fresh mobile boot (loadProgress) restores the exact value.
describe("uncapped balance persistence", () => {
  beforeEach(() => {
    clearGameProgress();
    useGameStore.setState({
      totalCoins: 0,
      coins: 0,
      score: 0,
      bestScore: 0,
      bestCombo: 0,
      bestComboRun: 0,
      combo: 0,
      currentLevel: 1,
    });
  });

  it("persists balances well above the R$20 progress bar goal", () => {
    // Simulate accumulated rewards far past the visual goal (20).
    const big = 987_654;
    useGameStore.setState({ totalCoins: big });
    useGameStore.getState().saveProgress();

    const raw = getSafeStorage<unknown>(null);
    expect(validateProgressData(raw)).toBe(true);
    if (validateProgressData(raw)) {
      expect(raw.totalCoins).toBe(big);
    }
  });

  it("reloads the uncapped balance on mobile boot", () => {
    setSafeStorage({
      totalCoins: 1_234_567.89,
      bestScore: 0,
      bestCombo: 0,
      currentLevel: 3,
      selectedSkin: "classic",
      unlockedSkins: ["classic"],
      selectedTheme: "cotton",
      unlockedThemes: ["cotton"],
      soundEnabled: true,
    });

    useGameStore.getState().loadProgress();
    expect(useGameStore.getState().totalCoins).toBe(1_234_567.89);
  });

  it("increments totalCoins across many reward claims without clamping", () => {
    const PER_PLATFORM = 1;
    const rewards = [50, 120, 300, 999]; // each 'reward' is money earned that run
    let expected = 0;
    for (const r of rewards) {
      const before = useGameStore.getState().totalCoins;
      useGameStore.setState({ totalCoins: before + r * PER_PLATFORM });
      useGameStore.getState().saveProgress();
      expected += r * PER_PLATFORM;
    }

    // Re-load as if the mobile app was reopened.
    useGameStore.setState({ totalCoins: 0 });
    useGameStore.getState().loadProgress();
    expect(useGameStore.getState().totalCoins).toBe(expected);
    expect(expected).toBeGreaterThan(20); // proves no goal-cap was applied
  });
});
