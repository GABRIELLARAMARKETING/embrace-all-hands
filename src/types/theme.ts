export type ThemeDecoration =
  | "clouds"
  | "lava"
  | "bubbles"
  | "stadium"
  | "candy"
  | "grid"
  | "snow"
  | "desert"
  | "stars"
  | "jungle";

export interface PreviewConfig {
  background: string;
  poleColor: string;
  platformColors: [string, string, string] | string[];
  dangerColor: string;
  ballColor: string;
  particleColor: string;
  decorations: ThemeDecoration[];
  cardGlow: string;
  thumbnailStyle: string;
}

export interface GameplayConfig {
  gravity: number;
  bounceForce: number;
  rotationSpeed: number;
  platformGap: number;
  dangerRatio: number;
  levelDifficulty: "easy" | "normal" | "hard";
  cameraShake: boolean;
  particleIntensity: "low" | "medium" | "high";
}

export interface UiConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  buttonGlow: string;
  textGlow: string;
  backgroundGradient: string;
}

export interface GameTheme {
  id: string;
  slug: string;
  name: string;
  label: string;
  description: string | null;
  category: string | null;
  rarity: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  unlock_type: string;
  unlock_price: number;
  min_level: number;
  preview_config: PreviewConfig;
  gameplay_config: GameplayConfig;
  ui_config: UiConfig;
}
