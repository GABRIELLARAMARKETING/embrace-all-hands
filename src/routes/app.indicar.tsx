import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowUp, Copy, PartyPopper, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppLayout, PlayerCard, GradientButton } from "@/components/player/AppLayout";
import { PLAYER_MOCK } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { copyToClipboard } from "@/utils/clipboard";
import { getReferralStats } from "@/lib/referral.functions";
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
      await new Promise((r) => setTimeout(r, 700));
      toast.success("Solicitação de saque enviada com sucesso!");
      setConfirmOpen(false);
    } catch {
      toast.error("Não foi possível processar o saque. Tente novamente.");
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
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 active:scale-[0.99]">
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
    </AppLayout>
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
