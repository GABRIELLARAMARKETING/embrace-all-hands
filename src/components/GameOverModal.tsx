import { motion, AnimatePresence } from "framer-motion";
import { Trophy, UserPlus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useGameStore } from "@/store/useGameStore";

export function GameOverModal({ open }: { open: boolean }) {
  const score = useGameStore((s) => s.score);
  const restartGame = useGameStore((s) => s.restartGame);
  const toMenu = useGameStore((s) => s.toMenu);
  const navigate = useNavigate();

  // Ganho potencial baseado no score (mínimo R$ 1,00).
  const potential = Math.max(1, score / 100);
  const formatted = potential.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-full max-w-sm rounded-[28px] border border-white/10 bg-[#1a0f1e] p-7 text-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]"
          >
            {/* Trophy */}
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
                <Trophy className="h-8 w-8 text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Título */}
            <h2 className="mt-4 text-center text-3xl font-black tracking-wide text-amber-400">
              PARABÉNS!
            </h2>
            <p className="mt-2 text-center text-sm text-white/70">
              Veja quanto você poderia ter ganho:
            </p>

            {/* Caixa do valor */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-5 py-5 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
                Você poderia ter ganhado
              </div>
              <div className="mt-2 text-4xl font-black text-amber-400">
                + R$ {formatted}
              </div>
            </div>

            {/* Texto */}
            <p className="mt-5 text-center text-sm leading-relaxed text-white/80">
              Parabéns pelo seu desempenho no teste grátis!
              <br />
              <span className="font-bold text-pink-400">
                Ganhe 50% de bônus
              </span>{" "}
              no seu primeiro depósito.
              <br />
              Comece a ganhar dinheiro de verdade agora!
            </p>

            {/* CTA */}
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-400 via-pink-500 to-fuchsia-600 px-6 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-[0_10px_30px_-5px_rgba(219,39,119,0.6)] transition-transform active:scale-95"
            >
              <UserPlus className="h-5 w-5" strokeWidth={2.5} />
              Criar conta grátis
            </button>

            {/* Ações secundárias */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/50">
              <button
                onClick={restartGame}
                className="transition-colors hover:text-white"
              >
                Tentar novamente
              </button>
              <span className="text-white/20">•</span>
              <button
                onClick={toMenu}
                className="transition-colors hover:text-white"
              >
                Menu
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
