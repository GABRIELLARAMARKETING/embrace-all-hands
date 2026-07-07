import { Modal } from "./Modal";
import { Button } from "./Button";
import { useGameStore } from "@/store/useGameStore";
import { formatScore } from "@/utils/formatScore";
import { COIN_SYMBOL } from "@/game/config/constants";

export function GameOverModal({ open }: { open: boolean }) {
  const score = useGameStore((s) => s.score);
  const coins = useGameStore((s) => s.coins);
  const bestComboRun = useGameStore((s) => s.bestComboRun);
  const restartGame = useGameStore((s) => s.restartGame);
  const toMenu = useGameStore((s) => s.toMenu);

  return (
    <Modal open={open} title="Você bateu no perigo.">
      <p className="text-white/70 text-sm mb-4">Tenta de novo, campeão.</p>
      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <Stat label="Score" value={formatScore(score)} />
        <Stat label={`${COIN_SYMBOL} Moedas`} value={String(coins)} />
        <Stat label="Combo" value={`x${bestComboRun}`} />
      </div>
      <div className="space-y-2">
        <Button className="w-full" onClick={restartGame}>Tentar novamente</Button>
        <Button className="w-full" variant="ghost" onClick={toMenu}>Menu</Button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
