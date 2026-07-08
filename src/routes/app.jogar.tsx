import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { AppLayout, GradientButton, PlayerCard } from "@/components/player/AppLayout";
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

  const selectedMap = useMemo(
    () => MAP_OPTIONS.find((m) => m.id === selectedMapId) ?? MAP_OPTIONS[0],
    [selectedMapId],
  );
  const reward = value ? value * 0.5 : 0;

  return (
    <AppLayout>
      <PlayerCard className="mt-4 overflow-hidden">
        <div className="relative p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#EC5FA3] to-[#7c1e9c] text-white shadow-[0_0_20px_rgba(236,95,163,0.5)]">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 4v5h-5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-extrabold">{PLAYER_MOCK.userName}</h2>
              <p className="text-sm text-white/60">Escolha seu mapa e jogue</p>
            </div>
            <div className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00D084]" />
              {PLAYER_MOCK.onlineUsers} online
            </div>
          </div>

          <SectionLabel className="mt-6">VALOR DE ENTRADA</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAYER_MOCK.playOptions.map((v) => (
              <button
                key={v}
                onClick={() => {
                  setValue(v);
                  setCustom("");
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-bold transition-all",
                  value === v && !custom
                    ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_0_18px_rgba(168,85,247,0.55)]"
                    : "bg-white/[0.05] text-white/80 hover:bg-white/10",
                )}
              >
                R${v}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3">
              <span className="text-sm font-semibold text-white/50">R$</span>
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
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-5 text-center">
            <div className="text-xs font-semibold tracking-widest text-white/60">RECOMPENSA MÍNIMA</div>
            <div className="mt-1 text-3xl font-black text-[#FFD600] drop-shadow-[0_0_12px_rgba(255,214,0,0.45)]">
              {formatCurrency(reward)}
            </div>
          </div>

          <SectionLabel className="mt-6">MAPA</SectionLabel>
          <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {MAP_OPTIONS.map((m) => {
              const active = m.id === selectedMapId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMap(m.id)}
                  className={cn(
                    "snap-center shrink-0 rounded-2xl transition-all",
                    active ? "scale-105 ring-2 ring-[#A855F7] shadow-[0_0_18px_rgba(168,85,247,0.55)]" : "opacity-70",
                  )}
                  aria-label={m.name}
                >
                  <div
                    className="h-28 w-20 rounded-2xl border border-white/10"
                    style={{ background: m.gradient }}
                  />
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-sm font-bold text-[#C084FC]">{selectedMap.name}</p>

          <GradientButton
            className="mt-5 flex items-center justify-center gap-2"
            disabled={!value}
            onClick={() => navigate({ to: "/game" })}
          >
            <Play className="h-5 w-5 fill-white" /> JOGAR — {formatCurrency(value ?? 0)}
          </GradientButton>
        </div>
      </PlayerCard>
    </AppLayout>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-bold tracking-widest text-[#C084FC]", className)}>{children}</div>
  );
}
