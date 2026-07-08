import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/player/AppLayout";
import { PLAYER_MOCK, MAP_OPTIONS } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/jogar")({
  head: () => ({
    meta: [
      { title: "Jogar — MultiHelixBr" },
      { name: "description", content: "Escolha seu mapa e valor de entrada para jogar." },
    ],
  }),
  component: JogarPage,
});

function JogarPage() {
  const navigate = useNavigate();
  const selectedMapId = usePlayerStore((s) => s.selectedMapId);
  const setSelectedMap = usePlayerStore((s) => s.setSelectedMap);
  const value = usePlayerStore((s) => s.selectedPlayValue);
  const setValue = usePlayerStore((s) => s.setSelectedPlayValue);
  const [custom, setCustom] = useState("");
  const carouselRef = useRef<HTMLDivElement>(null);

  const selectedMap = useMemo(
    () => MAP_OPTIONS.find((m) => m.id === selectedMapId) ?? MAP_OPTIONS[0],
    [selectedMapId],
  );
  const reward = value ? value * 0 : 0;

  const scroll = (dir: -1 | 1) => {
    carouselRef.current?.scrollBy({ left: dir * 100, behavior: "smooth" });
  };

  return (
    <AppLayout>
      <div className="relative mt-4 overflow-hidden rounded-[28px] border border-[#3a1d5a]/70 bg-[#120726]/85 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        {/* Top gradient band */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#4a1d7a]/60 to-transparent" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#F472B6] to-[#8B1FB0] shadow-[0_0_24px_rgba(236,95,163,0.55)]">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 4v5h-5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="truncate text-lg font-extrabold text-white">{PLAYER_MOCK.userName}</h2>
              <p className="text-[13px] text-white/55">Escolha seu mapa e jogue</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-[#0d1a15] px-3 py-1.5 text-[12px] font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00D084]" />
              <span className="font-black text-white">{PLAYER_MOCK.onlineUsers}</span>
              <span className="text-emerald-300/90">online</span>
            </div>
          </div>

          {/* Valor de entrada */}
          <div className="mt-6 text-[11px] font-bold tracking-widest text-[#B47CFF]">VALOR DE ENTRADA</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAYER_MOCK.playOptions.map((v) => {
              const active = value === v && !custom;
              return (
                <button
                  key={v}
                  onClick={() => {
                    setValue(v);
                    setCustom("");
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-bold transition-all",
                    active
                      ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_0_18px_rgba(168,85,247,0.55)]"
                      : "border border-[#3a1d5a] bg-[#1a0c30] text-white hover:border-[#5b2e8a]",
                  )}
                >
                  R${v}
                </button>
              );
            })}
          </div>

          {/* Custom input */}
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#3a1d5a] bg-[#1a0c30] px-4 py-3.5">
            <span className="text-sm font-semibold text-white/40">R$</span>
            <input
              inputMode="numeric"
              placeholder="Valor personalizado"
              value={custom}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d,]/g, "");
                setCustom(raw);
                const n = Number(raw.replace(",", "."));
                setValue(Number.isFinite(n) && n > 0 ? n : null);
              }}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>

          {/* Recompensa mínima */}
          <div className="mt-4 rounded-2xl border border-[#3a1d5a] bg-[#150a28] px-5 py-4 text-center">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-white/60">RECOMPENSA MÍNIMA</div>
            <div className="mt-1 text-3xl font-black text-[#FFD600] drop-shadow-[0_0_14px_rgba(255,214,0,0.55)]">
              {formatCurrency(reward)}
            </div>
          </div>

          {/* Mapa */}
          <div className="mt-6 text-[11px] font-bold tracking-widest text-[#B47CFF]">MAPA</div>
          <div className="relative mt-3">
            <button
              onClick={() => scroll(-1)}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label="Próximo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <div
              ref={carouselRef}
              className="flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-7 py-2 scrollbar-hide"
            >
              {MAP_OPTIONS.map((m) => {
                const active = m.id === selectedMapId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMap(m.id)}
                    className={cn(
                      "snap-center shrink-0 rounded-2xl p-[2px] transition-all",
                      active
                        ? "scale-110 bg-gradient-to-br from-[#F472B6] to-[#A855F7] shadow-[0_0_22px_rgba(236,95,163,0.5)]"
                        : "bg-transparent opacity-45",
                    )}
                    aria-label={m.name}
                  >
                    <div
                      className={cn(
                        "rounded-2xl border border-black/40",
                        active ? "h-28 w-[74px]" : "h-24 w-[62px]",
                      )}
                      style={{ background: m.gradient }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-center text-sm font-bold text-[#B47CFF]">{selectedMap.name}</p>

          {/* Play button */}
          <button
            disabled={!value}
            onClick={() => navigate({ to: "/game" })}
            className={cn(
              "mt-5 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15px] font-bold transition-all",
              value
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_10px_30px_-10px_rgba(236,95,163,0.7)] active:scale-[0.98]"
                : "cursor-not-allowed border border-[#3a1d5a] bg-[#1a0c30] text-white/45",
            )}
          >
            <Play className="h-4 w-4 fill-current" />
            JOGAR — {formatCurrency(value ?? 0)}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
