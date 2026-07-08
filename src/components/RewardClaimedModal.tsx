import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Play, Home } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";

interface Props {
  open: boolean;
  platforms: number;
  rewardPerPlatform: number;
  rewardAmount: number;
  newBalance: number;
  onPlayAgain: () => void;
  onGoToDashboard: () => void;
}

export function RewardClaimedModal({
  open,
  platforms,
  rewardPerPlatform,
  rewardAmount,
  newBalance,
  onPlayAgain,
  onGoToDashboard,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[88%] max-w-[450px] overflow-hidden rounded-[30px] px-6 py-7 sm:px-7 sm:py-8"
            style={{
              maxHeight: "calc(100vh - 32px)",
              border: "1px solid rgba(255, 196, 0, 0.45)",
              background:
                "linear-gradient(180deg, #241b10 0%, #160d0b 45%, #181111 100%)",
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.65), 0 0 35px rgba(255,190,0,0.08)",
            }}
          >
            {/* golden inner glow */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at top center, rgba(255, 190, 20, 0.18), transparent 38%)",
              }}
            />

            <div className="relative flex flex-col items-center">
              {/* Trophy icon */}
              <div
                className="flex h-[90px] w-[90px] items-center justify-center rounded-full"
                style={{
                  background: "linear-gradient(135deg, #FFC400, #FF9F0A)",
                  boxShadow: "0 10px 30px rgba(255, 181, 0, 0.35)",
                }}
              >
                <Trophy size={44} className="text-white" strokeWidth={2.4} />
              </div>

              {/* Title */}
              <h2
                className="mt-[26px] text-center font-black uppercase"
                style={{
                  color: "#FFC107",
                  fontSize: "28px",
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                }}
              >
                Prêmio Resgatado!
              </h2>

              {/* Subtitle */}
              <p
                className="mt-3 max-w-[300px] text-center"
                style={{
                  color: "rgba(255,255,255,0.62)",
                  fontSize: "16px",
                  fontWeight: 600,
                  lineHeight: 1.35,
                }}
              >
                Você passou {platforms} plataformas e resgatou o prêmio!
              </p>

              {/* Prize card */}
              <div
                className="mt-[30px] flex w-full flex-col items-center justify-center rounded-[18px] px-4 py-4"
                style={{
                  minHeight: 116,
                  background: "rgba(58, 42, 20, 0.55)",
                  border: "1px solid rgba(255, 196, 0, 0.38)",
                }}
              >
                <div
                  className="uppercase"
                  style={{
                    color: "#D6A900",
                    fontSize: "14px",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                  }}
                >
                  Você ganhou
                </div>
                <div
                  className="mt-1 whitespace-nowrap text-center font-black"
                  style={{
                    color: "#FFC107",
                    fontSize: "clamp(34px, 10vw, 46px)",
                    letterSpacing: "-1px",
                    lineHeight: 1.05,
                  }}
                >
                  + {formatCurrency(rewardAmount)}
                </div>
              </div>

              {/* Calculation line */}
              <p
                className="mt-[22px] text-center"
                style={{
                  color: "rgba(255,255,255,0.48)",
                  fontSize: "15px",
                  fontWeight: 700,
                }}
              >
                {platforms} plataformas × {formatCurrency(rewardPerPlatform)} ={" "}
                {formatCurrency(rewardAmount)}
              </p>

              {/* New balance capsule */}
              <div
                className="mt-[14px] flex h-[46px] w-full items-center justify-center rounded-[12px]"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.72)",
                  fontSize: "16px",
                  fontWeight: 800,
                }}
              >
                Novo saldo: {formatCurrency(newBalance)}
              </div>

              {/* Buttons */}
              <div className="mt-6 flex w-full items-center gap-3">
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="flex h-[62px] flex-[1.4] items-center justify-center gap-2 rounded-full text-white transition-transform active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #FF4FA3, #C42DCC)",
                    fontSize: "18px",
                    fontWeight: 900,
                    boxShadow: "0 12px 28px rgba(255, 65, 170, 0.42)",
                  }}
                >
                  <Play size={20} fill="currentColor" strokeWidth={0} />
                  Jogar Novamente
                </button>
                <button
                  type="button"
                  onClick={onGoToDashboard}
                  className="flex h-[62px] flex-1 items-center justify-center gap-2 rounded-full transition-transform active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    color: "rgba(255,255,255,0.74)",
                    fontSize: "18px",
                    fontWeight: 800,
                  }}
                >
                  <Home size={20} strokeWidth={2.2} />
                  Painel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
