// Safe localStorage layer with validation.
const KEY = "helix-cash:progress:v1";

export function getSafeStorage<T>(fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function setSafeStorage(value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // swallow — storage full/blocked
  }
}

export function clearGameProgress(): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}

export function validateProgressData(data: unknown): data is {
  totalCoins: number;
  bestScore: number;
  bestCombo: number;
  currentLevel: number;
  selectedSkin: string;
  unlockedSkins: string[];
  selectedTheme: string;
  unlockedThemes: string[];
  soundEnabled: boolean;
} {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  return (
    num(d.totalCoins) &&
    num(d.bestScore) &&
    num(d.bestCombo) &&
    num(d.currentLevel) &&
    typeof d.selectedSkin === "string" &&
    Array.isArray(d.unlockedSkins) &&
    typeof d.selectedTheme === "string" &&
    Array.isArray(d.unlockedThemes) &&
    typeof d.soundEnabled === "boolean"
  );
}
