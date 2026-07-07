import type { ThemeId } from "@/game/config/themes";

/** Maps a backend theme slug to the closest in-game ThemeId used by the physics/render layer. */
export const SLUG_TO_GAME_THEME: Record<string, ThemeId> = {
  classic: "cotton",
  "dark-inferno": "lava",
  ocean: "ocean",
  football: "cyber",
  candy: "candy",
  "neon-cyber": "neon",
  ice: "ocean",
  desert: "gold",
  galaxy: "neon",
  jungle: "luxury",
  "lava-gold": "gold",
  vaporwave: "candy",
};

export function slugToGameTheme(slug: string): ThemeId {
  return SLUG_TO_GAME_THEME[slug] ?? "cotton";
}
