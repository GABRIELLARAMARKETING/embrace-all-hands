import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { DollarSign, Tag, X, Copy } from "lucide-react";
import { AppLayout, GradientButton, PlayerCard } from "@/components/player/AppLayout";
import { PLAYER_MOCK, DEPOSIT_BADGES } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { depositSchema, type DepositFormValues } from "@/utils/playerValidators";
import { copyToClipboard } from "@/utils/clipboard";
import { cn } from "@/lib/utils";
import helixLogo from "@/assets/helix-multi-logo.png";

export const Route = createFileRoute("/app/depositar")({
  head: () => ({
    meta: [
      { title: "Depositar via PIX — MultiHelixBr" },
      { name: "description", content: "Deposite via PIX para jogar." },
    ],
  }),
  component: DepositarPage,
});

const BADGE_COLORS: Record<string, string> = {
  min: "bg-[#FF9F0A] text-black",
  hot: "bg-[#00D084] text-black",
  pop: "bg-[#EF4444] text-white",
  bonus: "bg-[#EC5FA3] text-white",
};

function DepositarPage() {
  const balance = usePlayerStore((s) => s.balance);
  const [showCoupon, setShowCoupon] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 20 },
  });
  const amount = watch("amount");

  const onSubmit = () => setModalOpen(true);

  return (
    <AppLayout title="Depositar via PIX">
      <GameLogo />

      <PlayerCard className="mt-4 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-widest text-white/60">SALDO ATUAL</div>
            <div className="text-2xl font-black text-emerald-400">{formatCurrency(balance)}</div>
          </div>
          <div className="shrink-0 text-right text-xs text-white/50 leading-tight">
            disponível<br />na conta
          </div>
        </div>
      </PlayerCard>

      <form onSubmit={handleSubmit(onSubmit)}>
        <PlayerCard className="mt-4 p-4">
          <div className="text-[11px] font-bold tracking-widest text-[#C084FC]">VALOR RÁPIDO</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAYER_MOCK.depositOptions.map((v) => {
              const badge = DEPOSIT_BADGES[v];
              const active = amount === v;
              return (
                <div key={v} className="relative pt-3">
                  {badge && (
                    <span
                      className={cn(
                        "absolute -top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black tracking-wide",
                        BADGE_COLORS[badge.tone],
                      )}
                    >
                      {badge.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setValue("amount", v, { shouldValidate: true })}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-bold transition-all",
                      active
                        ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_0_18px_rgba(168,85,247,0.55)]"
                        : "bg-white/[0.05] text-white/80",
                    )}
                  >
                    R${v}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-3">
            <span className="text-sm font-semibold text-white/60">R$</span>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              {...register("amount", { valueAsNumber: true })}
              className="w-full bg-transparent text-lg font-bold text-white outline-none"
            />
          </div>
          {errors.amount && (
            <p className="mt-2 text-xs text-red-400">{errors.amount.message}</p>
          )}

          <button
            type="button"
            onClick={() => setShowCoupon((v) => !v)}
            className="mt-3 flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <Tag className="h-4 w-4" /> Tenho um cupom
          </button>
          {showCoupon && (
            <input
              {...register("coupon")}
              placeholder="Código do cupom"
              className="mt-2 w-full rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
            />
          )}
        </PlayerCard>

        <GradientButton type="submit" className="mt-4">
          Gerar QR Code PIX
        </GradientButton>
      </form>

      <PixQrModal open={modalOpen} onClose={() => setModalOpen(false)} amount={amount} />
    </AppLayout>
  );
}

function GameLogo() {
  return (
    <div className="mt-2 flex justify-center">
      <div className="rounded-2xl bg-gradient-to-br from-[#7c1e9c] to-[#1e0938] px-6 py-3 shadow-[0_0_28px_rgba(168,85,247,0.45)]">
        <div className="text-2xl font-black tracking-tighter">
          <span className="bg-gradient-to-r from-[#00D084] via-[#FFD600] to-[#EC5FA3] bg-clip-text text-transparent">
            Helix
          </span>
          <span className="ml-1 text-white/90">MULTI</span>
        </div>
      </div>
    </div>
  );
}

function PixQrModal({ open, onClose, amount }: { open: boolean; onClose: () => void; amount: number }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#160828] p-6 text-center"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-white/60 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white">QR Code PIX gerado</h3>
            <p className="mt-1 text-xs text-white/60">
              Esta é uma simulação visual. Integre seu provedor de pagamento para ambiente real.
            </p>
            <div className="mx-auto mt-5 grid h-56 w-56 place-items-center rounded-2xl bg-white p-3">
              <QrPlaceholder />
            </div>
            <div className="mt-4 text-sm text-white/70">
              Valor: <span className="font-bold text-white">{formatCurrency(amount)}</span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <GradientButton
                onClick={async () => {
                  const ok = await copyToClipboard(PLAYER_MOCK.pixMockCode);
                  toast[ok ? "success" : "error"](ok ? "Código PIX copiado!" : "Falha ao copiar");
                }}
                className="flex items-center justify-center gap-2"
              >
                <Copy className="h-4 w-4" /> Copiar código PIX
              </GradientButton>
              <button
                onClick={onClose}
                className="w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QrPlaceholder() {
  const cells = Array.from({ length: 21 * 21 });
  return (
    <div className="grid h-full w-full grid-cols-[repeat(21,1fr)] gap-[2px]">
      {cells.map((_, i) => {
        const on = ((i * 131) % 7 < 3) || (i % 5 === 0);
        return <div key={i} className={on ? "bg-black" : "bg-white"} />;
      })}
    </div>
  );
}
