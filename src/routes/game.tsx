import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameCanvas } from "@/components/GameCanvas";
import { MainMenu } from "@/components/MainMenu";
import { GameHUD } from "@/components/GameHUD";
import { PauseMenu } from "@/components/PauseMenu";
import { GameOverModal } from "@/components/GameOverModal";

import { ThemeSelector } from "@/components/ThemeSelector";
import { SkinShop } from "@/components/SkinShop";
import { useGameStore } from "@/store/useGameStore";
import { PhysicsDebugOverlay } from "@/components/PhysicsDebugOverlay";
import { CoinPopLayer } from "@/components/CoinPopLayer";
import { MoneyProgressBar } from "@/components/MoneyProgressBar";
import { useGameSession } from "@/hooks/useGameSession";
import { useThemePreload } from "@/hooks/useThemePreload";
import { useHelixDifficultyLoader } from "@/hooks/useHelixDifficultyLoader";
import { LogoHelix } from "@/components/LogoHelix";


export const Route = createFileRoute("/game")({
  component: GamePage,
});

function GamePage() {
  const gameState = useGameStore((s) => s.gameState);
  const loadProgress = useGameStore((s) => s.loadProgress);
  const [themesOpen, setThemesOpen] = useState(false);
  const [skinsOpen, setSkinsOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [splash, setSplash] = useState(true);
  const { finishSession } = useGameSession();
  useThemePreload();
  useHelixDifficultyLoader();

  const score = useGameStore((s) => s.score);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const prevStateRef = useRef(gameState);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev === "playing" && (gameState === "gameOver" || gameState === "victory")) {
      finishSession({
        score,
        level_reached: currentLevel,
        status: gameState === "victory" ? "finished" : "gameover",
      });
    }
    prevStateRef.current = gameState;
  }, [gameState, finishSession, score, currentLevel]);

  useEffect(() => {
    loadProgress();
    const t = setTimeout(() => setSplash(false), 900);
    return () => clearTimeout(t);
  }, [loadProgress]);

  useEffect(() => {
    if (gameState === "playing") setHintVisible(true);
  }, [gameState]);

  const idle = gameState === "menu";


  return (
    <main className="relative h-screen w-screen overflow-hidden font-sans select-none">
      <GameCanvas onFirstInput={() => setHintVisible(false)} idle={idle} />

      {gameState === "menu" && (
        <MainMenu
          onOpenThemes={() => setThemesOpen(true)}
          onOpenSkins={() => setSkinsOpen(true)}
        />
      )}

      {(gameState === "playing" || gameState === "paused") && (
        <GameHUD showHint={hintVisible && gameState === "playing"} />
      )}

      <PhysicsDebugOverlay />
      <CoinPopLayer />
      <MoneyProgressBar />

      <PauseMenu open={gameState === "paused"} />
      <GameOverModal open={gameState === "gameOver"} />
      
      <ThemeSelector open={themesOpen} onClose={() => setThemesOpen(false)} />
      <SkinShop open={skinsOpen} onClose={() => setSkinsOpen(false)} />

      <AnimatePresence>
        {splash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-fuchsia-950"
          >
            <div className="flex flex-col items-center text-center">
              <LogoHelix className="w-[140px] sm:w-[170px]" />
              <div className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-white">
                HELIX{" "}
                <span className="bg-gradient-to-br from-amber-300 to-fuchsia-400 bg-clip-text text-transparent">
                  FAST
                </span>
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.4em] text-white/60">
                Carregando...
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
