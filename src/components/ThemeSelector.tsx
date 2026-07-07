import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { THEME_LIST, type Theme } from "@/game/config/themes";
import { useGameStore } from "@/store/useGameStore";

const FALLBACK_BG = "linear-gradient(180deg,#24104F 0%,#090014 100%)";

export function ThemeSelector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selected = useGameStore((s) => s.selectedTheme);
  const selectTheme = useGameStore((s) => s.selectTheme);
  const trackRef = useRef<HTMLDivElement>(null);

  // Auto-center the selected card whenever it changes or the modal opens.
  useEffect(() => {
    if (!open) return;
    const track = trackRef.current;
    if (!track) return;
    const node = track.querySelector<HTMLElement>(`[data-theme-id="${selected}"]`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [open, selected]);

  const scrollByDir = (dir: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * track.clientWidth * 0.6, behavior: "smooth" });
  };

  return (
    <Modal open={open} title="Temas">
      <div className="relative">
        {/* Left arrow */}
        <button
          onClick={() => scrollByDir(-1)}
          aria-label="Anterior"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Carousel */}
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory items-center gap-4 overflow-x-auto scroll-smooth px-10 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {THEME_LIST.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={selected === t.id}
              onSelect={() => selectTheme(t.id)}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scrollByDir(1)}
          aria-label="Próximo"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-4">
        <Button className="w-full" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}

function ThemeCard({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      data-theme-id={theme.id}
      onClick={onSelect}
      className={[
        "relative flex-shrink-0 snap-center overflow-hidden rounded-3xl border transition-all duration-500 focus:outline-none",
        active
          ? "h-64 w-44 scale-100 border-white/70 shadow-[0_0_35px_rgba(168,85,247,0.55)]"
          : "h-56 w-36 scale-90 border-white/10 opacity-70 hover:opacity-90",
      ].join(" ")}
      style={{ background: theme.bgGradient || FALLBACK_BG }}
      aria-pressed={active}
      aria-label={theme.name}
    >

      {/* Bottom gradient for label legibility */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      {/* Label */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 text-white">
        <span className="truncate text-sm font-bold drop-shadow">{theme.name}</span>
        {active && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-slate-900">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Dim overlay for inactive cards */}
      {!active && <div className="absolute inset-0 bg-black/25" />}
    </button>
  );
}
