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
  const hasNext = false;

  return (
    <Modal open={open} title="Parabéns!">
      <div className="mb-5 grid grid-cols-1 gap-3 text-center">
        <div className="rounded-xl border border-white/10 bg-white/5 py-3">
          <div className="text-[10px] uppercase tracking-widest text-white/50">
            Score
          </div>
          <div className="text-2xl font-bold">{formatScore(score)}</div>
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
          onClick={() => startGame(currentLevel)}
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
