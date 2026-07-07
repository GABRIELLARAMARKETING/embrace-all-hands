import { Modal } from "./Modal";
import { Button } from "./Button";
import { SKIN_LIST } from "@/game/config/skins";
import { useGameStore } from "@/store/useGameStore";
import { COIN_SYMBOL } from "@/game/config/constants";
import { Lock } from "lucide-react";

export function SkinShop({ open, onClose }: { open: boolean; onClose: () => void }) {
  const unlocked = useGameStore((s) => s.unlockedSkins);
  const selected = useGameStore((s) => s.selectedSkin);
  const totalCoins = useGameStore((s) => s.totalCoins);
  const unlockSkin = useGameStore((s) => s.unlockSkin);
  const selectSkin = useGameStore((s) => s.selectSkin);

  return (
    <Modal open={open} title={`Skins  ·  ${COIN_SYMBOL} ${totalCoins}`}>
      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {SKIN_LIST.map((skin) => {
          const isUnlocked = unlocked.includes(skin.id);
          const isSelected = selected === skin.id;
          const canAfford = totalCoins >= skin.cost;
          return (
            <div key={skin.id} className="rounded-2xl border border-white/10 overflow-hidden bg-slate-800/60">
              <div className="flex items-center justify-center h-20">
                <div
                  className="h-14 w-14 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${skin.color}, ${skin.emissive})`,
                    boxShadow: `0 0 30px ${skin.color}80`,
                  }}
                />
              </div>
              <div className="p-2">
                <div className="text-sm font-bold">{skin.name}</div>
                {isUnlocked ? (
                  <button
                    disabled={isSelected}
                    onClick={() => selectSkin(skin.id)}
                    className="mt-1 w-full text-[11px] font-bold rounded-lg py-1 bg-white text-slate-900 disabled:bg-white/20 disabled:text-white"
                  >
                    {isSelected ? "EQUIPADA" : "EQUIPAR"}
                  </button>
                ) : (
                  <button
                    disabled={!canAfford}
                    onClick={() => unlockSkin(skin.id)}
                    className="mt-1 w-full text-[11px] font-bold rounded-lg py-1 bg-amber-400 text-slate-900 disabled:bg-white/10 disabled:text-white/40 flex items-center justify-center gap-1"
                  >
                    <Lock size={11} /> {COIN_SYMBOL} {skin.cost}
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
