import { Modal } from "./Modal";
import { Button } from "./Button";
import { useGameStore } from "@/store/useGameStore";

export function PauseMenu({ open }: { open: boolean }) {
  const resumeGame = useGameStore((s) => s.resumeGame);
  const restartGame = useGameStore((s) => s.restartGame);
  const toMenu = useGameStore((s) => s.toMenu);

  return (
    <Modal open={open} title="Pausado">
      <div className="space-y-3">
        <Button className="w-full" onClick={resumeGame}>Continuar</Button>
        <Button className="w-full" variant="ghost" onClick={restartGame}>Reiniciar</Button>
        <Button className="w-full" variant="ghost" onClick={toMenu}>Sair para o menu</Button>
      </div>
    </Modal>
  );
}
