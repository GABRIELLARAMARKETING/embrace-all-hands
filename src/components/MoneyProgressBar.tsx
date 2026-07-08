import { useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { formatCurrency } from "@/utils/formatCurrency";

const GOAL = 20;
const PER_PLATFORM = 1;

export function MoneyProgressBar() {
  const gameState = useGameStore((s) => s.gameState);
  const [money, setMoney] = useState(0);
  const [platforms, setPlatforms] = useState(0);

  // Reset when a new run starts.
  useEffect(() => {
    if (gameState === "playing") {
      setMoney(0);
      setPlatforms(0);
    }
  }, [gameState]);

  useEffect(() => {
    const onPop = (e: Event) => {
      const detail = (e as CustomEvent<{ value: number }>).detail;
      setMoney((m) => Math.min(GOAL, m + (detail?.value ?? PER_PLATFORM)));
      setPlatforms((p) => p + 1);
    };
    window.addEventListener("coin-pop", onPop);
    return () => window.removeEventListener("coin-pop", onPop);
  }, []);

  if (gameState !== "playing" && gameState !== "paused") return null;

  const pct = Math.min(100, (money / GOAL) * 100);
  const completed = money >= GOAL;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-black/45 px-4 py-3 backdrop-blur-md ring-1 ring-white/10 shadow-lg">
          <div className="flex items-baseline justify-center gap-2 text-sm font-black tracking-tight">
            <span className="text-sky-400 drop-shadow">{formatCurrency(money)}</span>
            <span className="text-white/50">/</span>
            <span className="text-white/70">{formatCurrency(GOAL)}</span>
          </div>
          <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.65)] transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 text-center text-[11px] font-semibold text-white/70">
            {platforms} plataformas • +{formatCurrency(PER_PLATFORM)}/plat
          </div>
        </div>
      </div>

      {completed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pb-6 sm:pb-8">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("redeem-reward", { detail: { value: GOAL } }));
            }}
            className="pointer-events-auto w-full max-w-sm rounded-full bg-gradient-to-b from-amber-300 to-yellow-500 px-6 py-4 text-base font-black tracking-tight text-amber-950 shadow-[0_10px_30px_rgba(0,0,0,0.35),inset_0_-3px_0_rgba(0,0,0,0.15)] ring-2 ring-amber-200/70 transition active:scale-[0.98]"
          >
            🏆 RESGATAR {formatCurrency(GOAL)}
          </button>
          <span className="mt-2 text-xs font-semibold text-amber-200/80 drop-shadow">
            Continue jogando para ganhar mais!
          </span>
        </div>
      )}
    </>
  );
}

