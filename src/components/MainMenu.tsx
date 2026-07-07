import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { MAP_THEMES } from "@/data/themes";
import { LogoHelix } from "./LogoHelix";
import { LiveCounter } from "./LiveCounter";
import { ThemeCarousel } from "./ThemeCarousel";
import { PrimaryButton } from "./PrimaryButton";
import { AuthActions } from "./AuthActions";

interface Props {
  onOpenThemes: () => void;
  onOpenSkins: () => void;
}

export function MainMenu({ onOpenThemes, onOpenSkins }: Props) {
  const startGame = useGameStore((s) => s.startGame);
  const selectedGameTheme = useGameStore((s) => s.selectedTheme);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);
  const selectGameTheme = useGameStore((s) => s.selectTheme);

  // Initial carousel index tries to reflect the currently selected in-game theme.
  const initialIndex = useMemo(() => {
    const idx = MAP_THEMES.findIndex((m) => m.gameThemeId === selectedGameTheme);
    return idx >= 0 ? idx : 0;
  }, [selectedGameTheme]);
  const [index, setIndex] = useState(initialIndex);

  const handleChange = (i: number) => {
    setIndex(i);
    const mapped = MAP_THEMES[i].gameThemeId;
    if (unlockedThemes.includes(mapped)) selectGameTheme(mapped);
  };

  const handlePlayFree = () => {
    // eslint-disable-next-line no-console
    console.log("[HelixMulti] handlePlayFree", { map: MAP_THEMES[index].id });
    startGame();
  };

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-10 h-full w-full overflow-y-auto"
      style={{
        fontFamily:
          "'Poppins', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background:
          "radial-gradient(120% 80% at 50% 40%, #3a0f52 0%, #310840 30%, #21002f 65%, #180026 100%)",
        touchAction: "pan-y",
      }}
    >
      {/* Central soft glow behind the carousel */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(168,85,247,0.35), rgba(168,85,247,0.08) 60%, transparent 80%)",
          filter: "blur(4px)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-full max-w-[900px] flex-col items-center justify-between gap-4 px-4 py-5 sm:py-6">
        <div className="flex w-full flex-col items-center gap-3">
          <LogoHelix />
          <LiveCounter />

          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="mt-1 text-center text-[13px] sm:text-[15px] font-bold uppercase tracking-[0.35em] text-fuchsia-200/80"
          >
            Escolha seu mapa
          </motion.p>
        </div>

        <div className="w-full">
          <ThemeCarousel index={index} onChange={handleChange} />
        </div>

        <div className="flex w-full flex-col items-center gap-3 pb-3">
          <PrimaryButton onClick={handlePlayFree} aria-label="Jogar grátis">
            JOGAR GRATIS
          </PrimaryButton>
          <AuthActions
            onLogin={onOpenSkins}
            onSignup={onOpenThemes}
          />
        </div>
      </div>
    </div>
  );
}
