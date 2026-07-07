import { useEffect } from "react";
import type { GameTheme } from "@/types/theme";

interface Props {
  theme: GameTheme | undefined;
}

/**
 * Applies the currently selected theme's UI colors as CSS variables on <html>,
 * so any component can consume `var(--theme-primary)` etc. Safe on SSR.
 */
export function ThemeProvider({ theme }: Props) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const ui = theme.ui_config;
    const pv = theme.preview_config;
    root.style.setProperty("--theme-primary", ui.primaryColor);
    root.style.setProperty("--theme-secondary", ui.secondaryColor);
    root.style.setProperty("--theme-accent", ui.accentColor);
    root.style.setProperty("--theme-button-glow", ui.buttonGlow);
    root.style.setProperty("--theme-text-glow", ui.textGlow);
    root.style.setProperty("--theme-bg-gradient", ui.backgroundGradient);
    root.style.setProperty("--theme-danger", pv.dangerColor);
    root.style.setProperty("--theme-ball", pv.ballColor);
    root.style.setProperty("--theme-glow", pv.cardGlow);
  }, [theme]);

  return null;
}
