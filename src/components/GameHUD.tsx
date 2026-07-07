import { useGameStore } from "@/store/useGameStore";
import { LEVELS } from "@/game/config/levels";
import { formatScore } from "@/utils/formatScore";
import { COIN_SYMBOL } from "@/game/config/constants";
import { Pause, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

export function GameHUD({ showHint }: { showHint: boolean }) {
  const score = useGameStore((s) => s.score);
  const coins = useGameStore((s) => s.coins);
  const totalCoins = useGameStore((s) => s.totalCoins);
  const combo = useGameStore((s) => s.combo);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const progress = useGameStore((s) => s.progress);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);

  const level = LEVELS[currentLevel - 1];
  const goal = 500 + currentLevel * 250; // virtual score target for the progress bar

  return (
    <>
      {/* Top bar — 3 blocks: left (saldo), center (score + progress + goal), right (level + pause) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-stretch gap-2 sm:gap-3">
          {/* Left — saldo (virtual coins) */}
          <div className="flex min-w-[86px] flex-col justify-center rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-white backdrop-blur-md">
            <span className="text-[9px] uppercase tracking-[0.18em] text-white/60">
              Saldo
            </span>
            <span className="text-sm font-bold text-amber-300">
              {COIN_SYMBOL} {totalCoins + coins}
            </span>
          </div>

          {/* Center — score, progress, goal */}
          <div className="flex flex-1 flex-col justify-center rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-white backdrop-blur-md">
            <div className="flex items-baseline justify-between">
              <span className="text-[9px] uppercase tracking-[0.18em] text-white/60">
                Score
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-white/60">
                Meta {formatScore(goal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black tabular-nums leading-none">
                {formatScore(score)}
              </span>
              <span className="text-[10px] text-white/60">
                {level?.name ?? `Nível ${currentLevel}`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-400 transition-[width] duration-200"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>

          {/* Right — pause */}
          <div className="flex items-center">
            <button
              onClick={pauseGame}
              className="rounded-2xl border border-white/10 bg-black/35 p-3 text-white backdrop-blur-md transition-colors hover:bg-black/50"
              aria-label="Pausar"
            >
              <Pause size={20} />
            </button>
          </div>
        </div>

        {/* Combo chip */}
        {combo > 1 && (
          <motion.div
            key={combo}
            initial={{ scale: 0.7, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="mx-auto mt-3 w-fit rounded-full bg-fuchsia-500/85 px-4 py-1 text-xs font-black tracking-[0.2em] text-white shadow-lg backdrop-blur"
          >
            COMBO x{combo}
          </motion.div>
        )}
      </div>

      {/* Floating sound toggle */}
      <button
        onClick={toggleSound}
        className="pointer-events-auto absolute bottom-5 right-5 z-20 rounded-full border border-white/20 bg-white/20 p-3 text-white backdrop-blur-md hover:bg-white/30"
        aria-label="Som"
      >
        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>

      {/* Drag hint */}
      {showHint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center text-sm font-semibold tracking-wide text-white/85 drop-shadow"
        >
          ← Arraste para girar a torre →
        </motion.div>
      )}

      <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-[10px] uppercase tracking-[0.25em] text-white/40">
        Moedas virtuais — sem dinheiro real
      </p>
    </>
  );
}
