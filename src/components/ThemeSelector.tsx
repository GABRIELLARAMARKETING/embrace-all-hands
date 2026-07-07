import { Modal } from "./Modal";
import { Button } from "./Button";
import { THEME_LIST } from "@/game/config/themes";
import { useGameStore } from "@/store/useGameStore";

export function ThemeSelector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selected = useGameStore((s) => s.selectedTheme);
  const selectTheme = useGameStore((s) => s.selectTheme);

  return (
    <Modal open={open} title="Temas">
      <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {THEME_LIST.map((t) => {
          const isSelected = selected === t.id;
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
                <button
                  disabled={isSelected}
                  onClick={() => selectTheme(t.id)}
                  className="mt-1 w-full text-[11px] font-bold rounded-lg py-1 bg-white text-slate-900 disabled:bg-white/20 disabled:text-white"
                >
                  {isSelected ? "SELECIONADO" : "SELECIONAR"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Button className="w-full" variant="ghost" onClick={onClose}>Fechar</Button></div>
    </Modal>
  );
}

