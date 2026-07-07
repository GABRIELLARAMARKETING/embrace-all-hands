import { motion } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import { Button } from "./Button";
import { COIN_SYMBOL } from "@/game/config/constants";
import { formatScore } from "@/utils/formatScore";

interface Props {
  onOpenThemes: () => void;
  onOpenSkins: () => void;
}

export function MainMenu({ onOpenThemes, onOpenSkins }: Props) {
  const startGame = useGameStore((s) => s.startGame);
  const bestScore = useGameStore((s) => s.bestScore);
  const totalCoins = useGameStore((s) => s.totalCoins);
  const currentLevel = useGameStore((s) => s.currentLevel);

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between p-6 pointer-events-none">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="pointer-events-auto mt-6 text-center"
      >
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          HELIX <span className="bg-gradient-to-br from-amber-300 to-fuchsia-400 bg-clip-text text-transparent">CASH</span>
        </h1>
        <p className="mt-2 text-sm text-white/80 max-w-sm mx-auto">
          Gire a torre, atravesse os espaços e colete moedas virtuais.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="pointer-events-auto w-full max-w-xs space-y-3"
      >
        <Button className="w-full" onClick={() => startGame()}>
          ▶ Jogar Agora
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" onClick={onOpenThemes}>Temas</Button>
          <Button variant="ghost" onClick={onOpenSkins}>Skins</Button>
        </div>
        <div className="mt-6 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 px-4 py-3 text-white grid grid-cols-3 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/60">Melhor</div>
            <div className="font-bold">{formatScore(bestScore)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/60">Nível</div>
            <div className="font-bold">{currentLevel}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/60">{COIN_SYMBOL} Total</div>
            <div className="font-bold text-amber-300">{totalCoins}</div>
          </div>
        </div>
        <p className="text-center text-[10px] text-white/50 mt-3">
          Jogo de habilidade com moedas virtuais. Sem dinheiro real.
        </p>
      </motion.div>
    </div>
  );
}
