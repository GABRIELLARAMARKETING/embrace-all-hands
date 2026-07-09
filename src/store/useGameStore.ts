import { create } from "zustand";
import { LEVELS } from "@/game/config/levels";
import { SKINS, type SkinId } from "@/game/config/skins";
import { THEMES, type ThemeId } from "@/game/config/themes";
import {
  getSafeStorage,
  setSafeStorage,
  validateProgressData,
} from "@/utils/storage";
import { setSoundEnabled, SFX } from "@/utils/sound";
import { helixRuntime } from "@/game/config/difficulty";


export type GameState = "menu" | "playing" | "paused" | "gameOver" | "victory";

interface Store {
  gameState: GameState;
  // Session
  score: number;
  coins: number; // coins collected this level
  combo: number;
  bestComboRun: number;
  currentLevel: number;
  progress: number; // 0..1 descent

  // Persisted
  totalCoins: number;
  bestScore: number;
  bestCombo: number;
  selectedSkin: SkinId;
  unlockedSkins: SkinId[];
  selectedTheme: ThemeId;
  unlockedThemes: ThemeId[];
  soundEnabled: boolean;

  // Actions
  startGame: (level?: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  toMenu: () => void;
  completeLevel: () => void;
  loseGame: () => void;
  collectCoin: (amount?: number) => void;
  addScore: (amount: number) => void;
  bumpCombo: () => void;
  resetCombo: () => void;
  setProgress: (p: number) => void;
  unlockSkin: (id: SkinId) => boolean;
  selectSkin: (id: SkinId) => void;
  unlockTheme: (id: ThemeId) => boolean;
  selectTheme: (id: ThemeId) => void;
  toggleSound: () => void;
  saveProgress: () => void;
  loadProgress: () => void;
}

const initialPersisted = {
  totalCoins: 0,
  bestScore: 0,
  bestCombo: 0,
  currentLevel: 1,
  selectedSkin: "classic" as SkinId,
  unlockedSkins: ["classic"] as SkinId[],
  selectedTheme: "cotton" as ThemeId,
  unlockedThemes: ["cotton"] as ThemeId[],
  soundEnabled: true,
};

export const useGameStore = create<Store>((set, get) => ({
  gameState: "menu",
  score: 0,
  coins: 0,
  combo: 0,
  bestComboRun: 0,
  progress: 0,
  ...initialPersisted,

  startGame: (level) =>
    set((s) => ({
      gameState: "playing",
      score: 0,
      coins: 0,
      combo: 0,
      bestComboRun: 0,
      progress: 0,
      currentLevel: level ?? s.currentLevel,
    })),
  pauseGame: () => set({ gameState: "paused" }),
  resumeGame: () => set({ gameState: "playing" }),
  restartGame: () =>
    set({
      gameState: "playing",
      score: 0,
      coins: 0,
      combo: 0,
      bestComboRun: 0,
      progress: 0,
    }),
  toMenu: () => set({ gameState: "menu" }),

  completeLevel: () => {
    const s = get();
    const reward = 25 + s.currentLevel * 5;
    SFX.win();
    set({
      gameState: "victory",
      totalCoins: s.totalCoins + s.coins + reward,
      bestScore: Math.max(s.bestScore, s.score),
      bestCombo: Math.max(s.bestCombo, s.bestComboRun),
    });
    get().saveProgress();
  },

  loseGame: () => {
    const s = get();
    SFX.lose();
    set({
      gameState: "gameOver",
      totalCoins: s.totalCoins + Math.floor(s.coins / 2),
      bestScore: Math.max(s.bestScore, s.score),
      bestCombo: Math.max(s.bestCombo, s.bestComboRun),
    });
    get().saveProgress();
  },

  collectCoin: (amount = 1) => {
    SFX.coin();
    const mult = helixRuntime.get().settings.scoreMultiplier;
    set((s) => ({ coins: s.coins + amount, score: s.score + Math.round(5 * amount * mult) }));
  },

  addScore: (amount) => {
    const mult = helixRuntime.get().settings.scoreMultiplier;
    set((s) => ({ score: s.score + Math.round(amount * mult) }));
  },


  bumpCombo: () => {
    set((s) => {
      const next = s.combo + 1;
      if (next > 0 && next % 3 === 0) SFX.combo();
      return { combo: next, bestComboRun: Math.max(s.bestComboRun, next) };
    });
  },
  resetCombo: () => set({ combo: 0 }),

  setProgress: (p) => set({ progress: p }),

  unlockSkin: (id) => {
    const s = get();
    const skin = SKINS[id];
    if (s.unlockedSkins.includes(id)) return true;
    if (s.totalCoins < skin.cost) return false;
    set({
      totalCoins: s.totalCoins - skin.cost,
      unlockedSkins: [...s.unlockedSkins, id],
    });
    get().saveProgress();
    return true;
  },
  selectSkin: (id) => {
    if (!get().unlockedSkins.includes(id)) return;
    set({ selectedSkin: id });
    get().saveProgress();
  },
  unlockTheme: (id) => {
    const s = get();
    const t = THEMES[id];
    if (s.unlockedThemes.includes(id)) return true;
    if (s.totalCoins < t.unlockCost) return false;
    set({
      totalCoins: s.totalCoins - t.unlockCost,
      unlockedThemes: [...s.unlockedThemes, id],
    });
    get().saveProgress();
    return true;
  },
  selectTheme: (id) => {
    if (!get().unlockedThemes.includes(id)) return;
    set({ selectedTheme: id });
    get().saveProgress();
  },

  toggleSound: () => {
    const next = !get().soundEnabled;
    setSoundEnabled(next);
    set({ soundEnabled: next });
    get().saveProgress();
  },

  saveProgress: () => {
    const s = get();
    setSafeStorage({
      totalCoins: s.totalCoins,
      bestScore: s.bestScore,
      bestCombo: s.bestCombo,
      currentLevel: s.currentLevel,
      selectedSkin: s.selectedSkin,
      unlockedSkins: s.unlockedSkins,
      selectedTheme: s.selectedTheme,
      unlockedThemes: s.unlockedThemes,
      soundEnabled: s.soundEnabled,
    });
  },

  loadProgress: () => {
    const data = getSafeStorage<unknown>(null);
    if (validateProgressData(data)) {
      setSoundEnabled(data.soundEnabled);
      set({
        totalCoins: data.totalCoins,
        bestScore: data.bestScore,
        bestCombo: data.bestCombo,
        currentLevel: data.currentLevel,
        selectedSkin: data.selectedSkin as SkinId,
        unlockedSkins: data.unlockedSkins as SkinId[],
        selectedTheme: data.selectedTheme as ThemeId,
        unlockedThemes: data.unlockedThemes as ThemeId[],
        soundEnabled: data.soundEnabled,
      });
    }
  },
}));
