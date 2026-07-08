import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUp, Copy, PartyPopper } from "lucide-react";
import { AppLayout, PlayerCard } from "@/components/player/AppLayout";
import { PLAYER_MOCK } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { copyToClipboard } from "@/utils/clipboard";
import helixLogo from "@/assets/helix-multi-logo.png";

export const Route = createFileRoute("/app/indicar")({
  head: () => ({
    meta: [
      { title: "Indicar Amigos — MultiHelixBr" },
      { name: "description", content: "Ganhe comissão indicando amigos." },
    ],
  }),
  component: IndicarPage,
});

function IndicarPage() {
  const affiliateBalance = usePlayerStore((s) => s.affiliateBalance);
  const totalReceived = usePlayerStore((s) => s.totalReceived);

  const copyLink = async () => {
    const ok = await copyToClipboard(PLAYER_MOCK.referralUrl);
    toast[ok ? "success" : "error"](ok ? "Link copiado com sucesso!" : "Falha ao copiar");
  };

  return (
    <AppLayout title="Indicar Amigos">
      <Logo />

      <PlayerCard className="mt-4 p-5">
        <div className="flex items-start gap-3">
          <PartyPopper className="h-5 w-5 shrink-0 text-[#FFD600]" />
          <p className="text-sm text-white/85">
            Ganhe <span className="font-bold text-[#C084FC]">{PLAYER_MOCK.commissionPercent}%</span> de comissão
            para cada amigo que fizer o primeiro depósito!
          </p>
        </div>
      </PlayerCard>

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
        <StatCard tier="N1" subtitle="diretos" />
        <StatCard tier="N2" subtitle="2º nível" />
        <StatCard tier="N3" subtitle="3º nível" />
        <StatCard tier="TOTAL" subtitle="rede" />
      </div>
    </AppLayout>
  );
}

function StatCard({ tier, subtitle }: { tier: string; subtitle: string }) {
  return (
    <PlayerCard className="p-4 text-center">
      <div className="text-lg font-black text-[#C084FC]">{tier}</div>
      <div className="text-xs text-white/60">{subtitle}</div>
      <div className="mt-3 text-lg font-black text-white">0</div>
      <div className="text-[10px] font-bold tracking-widest text-white/50">INDICADOS</div>
      <div className="mt-3 text-lg font-black text-white">R$ 0,00</div>
      <div className="text-[10px] font-bold tracking-widest text-white/50">TOTAL EM DEPÓSITOS</div>
    </PlayerCard>
  );
}

function Logo() {
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
