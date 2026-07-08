import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, User, History, Shield, LogOut, Link as LinkIcon } from "lucide-react";
import { AppLayout, PlayerCard } from "@/components/player/AppLayout";
import { PLAYER_MOCK } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { copyToClipboard } from "@/utils/clipboard";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — MultiHelixBr" },
      { name: "description", content: "Perfil do jogador." },
    ],
  }),
  component: PerfilPage,
});

function PerfilPage() {
  const navigate = useNavigate();
  const balance = usePlayerStore((s) => s.balance);
  const affiliateBalance = usePlayerStore((s) => s.affiliateBalance);
  const initial = PLAYER_MOCK.userName.charAt(0).toUpperCase();

  const copyLink = async () => {
    const ok = await copyToClipboard(PLAYER_MOCK.referralUrl);
    toast[ok ? "success" : "error"](ok ? "Link copiado!" : "Falha ao copiar");
  };

  return (
    <AppLayout title="Meu Perfil">
      <div className="mt-4 flex flex-col items-center">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#EC5FA3] to-[#7c1e9c] text-4xl font-black text-white shadow-[0_0_28px_rgba(236,95,163,0.55)]">
          {initial}
        </div>
        <h2 className="mt-3 text-xl font-black">Ricardo 350</h2>
        <p className="text-sm text-white/60">{PLAYER_MOCK.userEmail}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatBox value={formatCurrency(balance)} label="SALDO" tone="green" />
        <StatBox value={String(PLAYER_MOCK.matchesPlayed)} label="PARTIDAS" tone="purple" />
        <StatBox value={formatCurrency(affiliateBalance)} label="AFILIADO" tone="yellow" />
      </div>

      <PlayerCard className="mt-5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-white/60">
          <LinkIcon className="h-4 w-4" /> LINK DE DIVULGAÇÃO
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/[0.05] p-2">
          <div className="truncate flex-1 px-2 text-sm text-white/85">{PLAYER_MOCK.referralUrl}</div>
          <button
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] px-3 py-1.5 text-xs font-bold text-white"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
        </div>
      </PlayerCard>

      <div className="mt-4 space-y-2">
        <ActionRow icon={User} label="Meus dados" />
        <ActionRow icon={History} label="Histórico" />
        <ActionRow icon={Shield} label="Segurança" />
        <ActionRow
          icon={LogOut}
          label="Sair"
          danger
          onClick={() => {
            try {
              window.localStorage.removeItem("helix:player:v1");
            } catch {}
            navigate({ to: "/" });
          }}
        />
      </div>
    </AppLayout>
  );
}

function StatBox({ value, label, tone }: { value: string; label: string; tone: "green" | "purple" | "yellow" }) {
  const color =
    tone === "green" ? "text-emerald-400" : tone === "purple" ? "text-[#C084FC]" : "text-[#FFD600]";
  return (
    <PlayerCard className="p-3 text-center">
      <div className={`text-base font-black ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold tracking-widest text-white/60">{label}</div>
    </PlayerCard>
  );
}

function ActionRow({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-[#1a0a30]/70 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl ${
          danger ? "bg-red-500/15 text-red-400" : "bg-white/[0.05] text-[#C084FC]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className={`flex-1 text-sm font-semibold ${danger ? "text-red-300" : "text-white"}`}>{label}</span>
    </button>
  );
}
