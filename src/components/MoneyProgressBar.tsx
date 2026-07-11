import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGameStore } from "@/store/useGameStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { RewardClaimedModal } from "./RewardClaimedModal";

export function MoneyProgressBar() {
  const selectedPlayValue = usePlayerStore((s) => s.selectedPlayValue);
  // Regra oficial: por plataforma = 10% do depósito; meta = 5x o depósito.
  const PER_PLATFORM = useMemo(
    () => Math.round((selectedPlayValue ?? 5) * 10) / 100,
    [selectedPlayValue],
  );
  const GOAL = useMemo(() => (selectedPlayValue ?? 5) * 5, [selectedPlayValue]);
  const gameState = useGameStore((s) => s.gameState);
  const restartGame = useGameStore((s) => s.restartGame);
  const totalCoins = useGameStore((s) => s.totalCoins);
  const navigate = useNavigate();

  const [money, setMoney] = useState(0);
  const [platforms, setPlatforms] = useState(0);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState({
    platforms: 0,
    rewardAmount: 0,
    newBalance: 0,
  });

  useEffect(() => {
    if (gameState === "playing") {
      setMoney(0);
      setPlatforms(0);
    }
  }, [gameState]);

  useEffect(() => {
    // Publica o depósito atual para GameCanvas emitir moedas com valor correto.
    (window as unknown as { __helixDeposit?: number }).__helixDeposit =
      selectedPlayValue ?? 5;
  }, [selectedPlayValue]);

  useEffect(() => {
    const onPop = () => {
      setMoney((m) => Math.round((m + PER_PLATFORM) * 100) / 100);
      setPlatforms((p) => p + 1);
    };
    window.addEventListener("coin-pop", onPop);
    return () => window.removeEventListener("coin-pop", onPop);
  }, [PER_PLATFORM]);

  useEffect(() => {
    if (!claimError) return;
    const t = setTimeout(() => setClaimError(null), 3200);
    return () => clearTimeout(t);
  }, [claimError]);

  const handleClaimReward = async () => {
    if (isClaimingReward) return;
    try {
      setIsClaimingReward(true);
      // Simulated confirmation of the redeem flow.
      await new Promise((r) => setTimeout(r, 250));
      const rewardAmount = money;
      const newBalance = totalCoins + rewardAmount;
      setSnapshot({
        platforms,
        rewardAmount,
        newBalance,
      });
      setShowRewardModal(true);
    } catch (err) {
      console.error("Erro ao resgatar recompensa:", err);
      setClaimError("Não foi possível resgatar a recompensa. Tente novamente.");
    } finally {
      setIsClaimingReward(false);
    }
  };

  const handlePlayAgain = () => {
    setShowRewardModal(false);
    restartGame();
  };

  const handleGoToDashboard = () => {
    setShowRewardModal(false);
    navigate({ to: "/app/jogar" });
  };

  const showBar = gameState === "playing" || gameState === "paused";
  const pct = Math.min(100, (money / GOAL) * 100);
  const completed = money >= GOAL;

  return (
    <>
      {showBar && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4 sm:px-6 sm:pt-5">
            <div className="mx-auto w-full max-w-md px-4 py-3">
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex w-full flex-col items-center justify-center px-6 pb-8 sm:pb-10">
              <button
                type="button"
                disabled={isClaimingReward}
                onClick={handleClaimReward}
                className="pointer-events-auto flex h-[64px] w-[78%] max-w-[300px] items-center justify-center gap-[10px] whitespace-nowrap rounded-full border-none bg-gradient-to-r from-[#FFC400] to-[#FFAB00] text-[18px] font-black tracking-[-0.3px] text-[#050505] shadow-[0_14px_28px_rgba(0,0,0,0.22)] outline-none transition-transform duration-150 active:scale-[0.98] disabled:opacity-70"
              >
                <span className="text-[20px] leading-none">🏆</span>
                <span>{isClaimingReward ? "RESGATANDO..." : `RESGATAR ${formatCurrency(money)}`}</span>
              </button>
              <p className="mt-[10px] text-center text-[14px] font-semibold text-[#FFD43B]">
                Continue jogando para ganhar mais!
              </p>
              {claimError && (
                <p className="pointer-events-auto mt-2 rounded-full bg-black/70 px-4 py-1.5 text-center text-[12px] font-semibold text-red-300">
                  {claimError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <RewardClaimedModal
        open={showRewardModal}
        platforms={snapshot.platforms}
        rewardPerPlatform={PER_PLATFORM}
        rewardAmount={snapshot.rewardAmount}
        newBalance={snapshot.newBalance}
        onPlayAgain={handlePlayAgain}
        onGoToDashboard={handleGoToDashboard}
      />
    </>
  );
}
