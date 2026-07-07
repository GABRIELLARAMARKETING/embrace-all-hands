import { Modal } from "./Modal";
import { Button } from "./Button";
import { THEME_LIST } from "@/game/config/themes";
import { useGameStore } from "@/store/useGameStore";
import { Lock } from "lucide-react";
import { COIN_SYMBOL } from "@/game/config/constants";

export function ThemeSelector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const unlocked = useGameStore((s) => s.unlockedThemes);
  const selected = useGameStore((s) => s.selectedTheme);
  const totalCoins = useGameStore((s) => s.totalCoins);
  const unlockTheme = useGameStore((s) => s.unlockTheme);
  const selectTheme = useGameStore((s) => s.selectTheme);

  return (
    <Modal open={open} title="Temas">
      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {THEME_LIST.map((t) => {
          const isUnlocked = unlocked.includes(t.id);
          const isSelected = selected === t.id;
          const canAfford = totalCoins >= t.unlockCost;
          return (
            <div key={t.id} className="rounded-2xl border border-white/10 overflow-hidden">
              <div
                className="h-20 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${t.bgImage}), ${t.bgGradient}`,
                }}
              />
              <div className="p-2 bg-black/40">
                <div className="text-sm font-bold">{t.name}</div>
                {isUnlocked ? (
                  <button
                    disabled={isSelected}
                    onClick={() => selectTheme(t.id)}
                    className="mt-1 w-full text-[11px] font-bold rounded-lg py-1 bg-white text-slate-900 disabled:bg-white/20 disabled:text-white"
                  >
                    {isSelected ? "SELECIONADO" : "SELECIONAR"}
                  </button>
                ) : (
                  <button
                    disabled={!canAfford}
                    onClick={() => unlockTheme(t.id)}
                    className="mt-1 w-full text-[11px] font-bold rounded-lg py-1 bg-amber-400 text-slate-900 disabled:bg-white/10 disabled:text-white/40 flex items-center justify-center gap-1"
                  >
                    <Lock size={11} /> {COIN_SYMBOL} {t.unlockCost}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Button className="w-full" variant="ghost" onClick={onClose}>Fechar</Button></div>
    </Modal>
  );
}
