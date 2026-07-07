import { Modal } from "./Modal";
import { Button } from "./Button";
import { useGameStore } from "@/store/useGameStore";
import { formatScore } from "@/utils/formatScore";
import { COIN_SYMBOL } from "@/game/config/constants";
import { LEVELS } from "@/game/config/levels";

export function VictoryModal({ open }: { open: boolean }) {
  const score = useGameStore((s) => s.score);
  const coins = useGameStore((s) => s.coins);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const startGame = useGameStore((s) => s.startGame);
  const toMenu = useGameStore((s) => s.toMenu);
  const reward = 25 + (currentLevel - 1) * 5;
  const totalReward = coins + reward;
  const hasNext = currentLevel <= LEVELS.length;

  return (
    <Modal open={open} title="Parabéns!">
      <p className="mb-1 text-center text-xs uppercase tracking-[0.25em] text-white/60">
        Você ganhou
      </p>
      <div className="mb-5 text-center">
        <div className="bg-gradient-to-br from-amber-300 to-fuchsia-400 bg-clip-text text-5xl font-black tracking-tight text-transparent">
          + {COIN_SYMBOL} {totalReward}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/40">
          Moedas virtuais
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-white/10 bg-white/5 py-2">
          <div className="text-[10px] uppercase tracking-widest text-white/50">
            Score
          </div>
          <div className="font-bold">{formatScore(score)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 py-2">
          <div className="text-[10px] uppercase tracking-widest text-white/50">
            Recompensa
          </div>
          <div className="font-bold text-amber-300">
            {COIN_SYMBOL} {reward}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {hasNext && (
          <Button className="w-full" onClick={() => startGame()}>
            Próximo nível →
          </Button>
        )}
        <Button
          className="w-full"
          variant="ghost"
          onClick={() => startGame(currentLevel - 1)}
        >
          Jogar novamente
        </Button>
        <Button className="w-full" variant="ghost" onClick={toMenu}>
          Menu
        </Button>
      </div>
    </Modal>
  );
}
