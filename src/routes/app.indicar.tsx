import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowUp, Copy, PartyPopper, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppLayout, PlayerCard, GradientButton } from "@/components/player/AppLayout";
import { PLAYER_MOCK } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { copyToClipboard } from "@/utils/clipboard";
import { getReferralStats } from "@/lib/referral.functions";
import { requestAffiliateWithdrawal } from "@/lib/withdrawals.functions";
import helixLogo from "@/assets/helix-multi-logo.png";

const referralStatsQuery = queryOptions({
  queryKey: ["referral-stats"],
  queryFn: () => getReferralStats(),
});

export const Route = createFileRoute("/app/indicar")({
  head: () => ({
    meta: [
      { title: "Indicar Amigos — MultiHelixBr" },
      { name: "description", content: "Ganhe comissão indicando amigos." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(referralStatsQuery),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Erro ao carregar: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-white/70">Não encontrado.</div>,
  component: IndicarPage,
});

function IndicarPage() {
  const { data } = useSuspenseQuery(referralStatsQuery);
  const setReferralStats = usePlayerStore((s) => s.setReferralStats);
  const queryClient = useQueryClient();
  const submitWithdrawal = useServerFn(requestAffiliateWithdrawal);

  useEffect(() => {
    setReferralStats(data.stats);
  }, [data.stats, setReferralStats]);

  const affiliateBalance = data.affiliateBalance;
  const totalReceived = data.totalReceived;
  const withdrawMin = PLAYER_MOCK.withdrawMin;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const copyLink = async () => {
    const ok = await copyToClipboard(PLAYER_MOCK.referralUrl);
    toast[ok ? "success" : "error"](ok ? "Link copiado com sucesso!" : "Falha ao copiar");
  };

  const handleWithdrawClick = () => {
    if (affiliateBalance < withdrawMin) {
      toast.error(
        `Saldo insuficiente. Mínimo para saque: ${formatCurrency(withdrawMin)}.`,
      );
      return;
    }
    setConfirmOpen(true);
  };

  const confirmWithdraw = async () => {
    setProcessing(true);
    try {
      await submitWithdrawal({ data: { amount: affiliateBalance } });
      toast.success("Solicitação de saque registrada com sucesso!");
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao solicitar saque.";
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  const tiers = ["N1", "N2", "N3", "TOTAL"] as const;

  return (
    <AppLayout title="Indicar Amigos">
      <div className="relative pt-14">
        <Logo />
        <PlayerCard className="p-5 pt-8">
          <div className="flex items-start gap-3">
            <PartyPopper className="h-5 w-5 shrink-0 text-[#FFD600]" />
            <p className="text-sm text-white/85 text-center flex-1">
              Ganhe <span className="font-bold text-[#C084FC]">{PLAYER_MOCK.commissionPercent}%</span> de comissão
              para cada amigo que fizer o primeiro depósito!
            </p>
          </div>
        </PlayerCard>
      </div>

      <div className="mt-4 rounded-3xl bg-gradient-to-br from-[#A855F7] to-[#EC5FA3] p-5 shadow-[0_10px_30px_-10px_rgba(236,95,163,0.6)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-white/80">SALDO DE AFILIADO</div>
            <div className="mt-1 text-3xl font-black text-white">{formatCurrency(affiliateBalance)}</div>
            <div className="mt-1 text-xs text-white/80">disponível para saque</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-widest text-white/80">TOTAL RECEBIDO</div>
            <div className="mt-1 text-3xl font-black text-white">{formatCurrency(totalReceived)}</div>
            <div className="mt-1 text-xs text-white/80">em comissões</div>
          </div>
        </div>
        <button
          onClick={handleWithdrawClick}
          type="button"
          aria-label="Sacar comissão de afiliado"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-[0.99]"
        >
          <ArrowUp className="h-4 w-4" /> Sacar Comissão
        </button>
      </div>

      <PlayerCard className="mt-4 p-5">
        <div className="text-xs text-white/60">Seu link exclusivo</div>
        <div className="mt-2 truncate text-sm font-bold text-white">{PLAYER_MOCK.referralUrl}</div>
        <button
          onClick={copyLink}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <Copy className="h-4 w-4" /> Copiar
        </button>
      </PlayerCard>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {tiers.map((tier) => {
          const s = data.stats[tier];
          return (
            <StatCard
              key={tier}
              tier={tier}
              subtitle={s.subtitle}
              count={s.count}
              deposits={s.deposits}
            />
          );
        })}
      </div>

      <ConfirmWithdrawModal
        open={confirmOpen}
        onClose={() => (processing ? null : setConfirmOpen(false))}
        onConfirm={confirmWithdraw}
        amount={affiliateBalance}
        minAmount={withdrawMin}
        processing={processing}
      />
    </AppLayout>
  );
}

function ConfirmWithdrawModal({
  open,
  onClose,
  onConfirm,
  amount,
  minAmount,
  processing,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  minAmount: number;
  processing: boolean;
}) {
  const insufficient = amount < minAmount;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-withdraw-title"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#160828] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              disabled={processing}
              aria-label="Fechar"
              className="absolute right-4 top-4 text-white/60 hover:text-white disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
            {insufficient ? (
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-400" />
            ) : (
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            )}
            <h3 id="confirm-withdraw-title" className="mt-3 text-lg font-bold text-white">
              Confirmar saque
            </h3>
            <p className="mt-1 text-sm text-white/70">
              {insufficient
                ? `Você precisa de no mínimo ${formatCurrency(minAmount)} para solicitar o saque.`
                : `Você deseja sacar ${formatCurrency(amount)} da sua comissão de afiliado?`}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <GradientButton
                onClick={onConfirm}
                disabled={insufficient || processing}
                className="disabled:opacity-60"
              >
                {processing ? "Processando..." : "Confirmar Saque"}
              </GradientButton>
              <button
                onClick={onClose}
                disabled={processing}
                className="w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  tier,
  subtitle,
  count,
  deposits,
}: {
  tier: string;
  subtitle: string;
  count: number;
  deposits: number;
}) {
  return (
    <PlayerCard className="p-4 text-center">
      <div className="text-lg font-black text-[#C084FC]">{tier}</div>
      <div className="text-xs text-white/60">{subtitle}</div>
      <div className="mt-3 text-lg font-black text-white">{count}</div>
      <div className="text-[10px] font-bold tracking-widest text-white/50">INDICADOS</div>
      <div className="mt-3 text-lg font-black text-white">{formatCurrency(deposits)}</div>
      <div className="text-[10px] font-bold tracking-widest text-white/50">TOTAL EM DEPÓSITOS</div>
    </PlayerCard>
  );
}

function Logo() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
      <img
        src={helixLogo}
        alt="Helix Multi"
        width={112}
        height={112}
        loading="lazy"
        className="h-28 w-28 drop-shadow-[0_0_20px_rgba(168,85,247,0.55)]"
      />
    </div>
  );
}
