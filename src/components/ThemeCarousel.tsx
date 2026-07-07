import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { GameTheme } from "@/types/theme";
import { MapCard } from "./MapCard";

interface Props {
  themes: GameTheme[];
  index: number;
  onChange: (index: number) => void;
}

export function ThemeCarousel({ themes, index, onChange }: Props) {
  const total = themes.length;
  const wrap = useCallback(
    (i: number) => (total === 0 ? 0 : ((i % total) + total) % total),
    [total],
  );

  const next = useCallback(() => onChange(wrap(index + 1)), [index, onChange, wrap]);
  const prev = useCallback(() => onChange(wrap(index - 1)), [index, onChange, wrap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    if (dx > 40) prev();
    else if (dx < -40) next();
    startX.current = null;
  };

  if (total === 0) return null;
  const current = themes[index];
  const visibleRange = [-2, -1, 0, 1, 2] as const;
  const glow = current.ui_config.textGlow ?? current.preview_config.cardGlow;

  return (
    <div className="w-full">
      <div
        className="relative mx-auto h-[240px] w-full max-w-[720px] overflow-hidden sm:h-[340px]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {visibleRange.map((offset) => {
          const i = wrap(index + offset);
          const role = offset === 0 ? "center" : Math.abs(offset) === 1 ? "near" : "far";
          const theme = themes[i];
          return (
            <MapCard
              key={`${theme.id}-${offset}`}
              theme={theme}
              role={role}
              offset={offset}
              onClick={() => onChange(i)}
            />
          );
        })}

        <button
          type="button"
          onClick={prev}
          aria-label="Mapa anterior"
          className="absolute left-2 top-1/2 z-40 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-md transition-all hover:border-fuchsia-400/70 hover:text-white hover:shadow-[0_0_24px_rgba(168,85,247,0.65)]"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Próximo mapa"
          className="absolute right-2 top-1/2 z-40 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white/90 backdrop-blur-md transition-all hover:border-fuchsia-400/70 hover:text-white hover:shadow-[0_0_24px_rgba(168,85,247,0.65)]"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-3 h-10 text-center">
        <AnimatePresence mode="wait">
          <motion.h2
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="text-2xl sm:text-[28px] font-extrabold tracking-[0.18em]"
            style={{
              color: glow,
              textShadow: `0 0 18px ${glow}88`,
            }}
          >
            {current.label}
          </motion.h2>
        </AnimatePresence>
      </div>
    </div>
  );
}
