import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link as LinkIcon, Lock, LogOut } from "lucide-react";
import { AppLayout, PlayerCard, GradientButton } from "@/components/player/AppLayout";
import { PLAYER_MOCK } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { copyToClipboard } from "@/utils/clipboard";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import helixLogo from "@/assets/helix-multi-logo.png";

const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: () => getMyProfile(),
});

export const Route = createFileRoute("/app/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu Perfil — MultiHelixBr" },
      { name: "description", content: "Perfil do jogador." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-400">Erro ao carregar perfil: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-white/70">Não encontrado.</div>,
  component: PerfilPage,
});


function PerfilPage() {
  const navigate = useNavigate();
  const balance = usePlayerStore((s) => s.balance);
  const affiliateBalance = usePlayerStore((s) => s.affiliateBalance);
  const initial = PLAYER_MOCK.userName.charAt(0).toUpperCase();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const copyLink = async () => {
    const ok = await copyToClipboard(PLAYER_MOCK.referralUrl);
    toast[ok ? "success" : "error"](ok ? "Link copiado!" : "Falha ao copiar");
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next || !confirm) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (next.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (next !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      toast.success("Senha alterada com sucesso!");
      setCurrent("");
      setNext("");
      setConfirm("");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    try {
      window.localStorage.removeItem("helix:player:v1");
    } catch {}
    navigate({ to: "/" });
  };

  return (
    <AppLayout title="Meu Perfil">
      <div className="flex flex-col items-center pt-2">
        <img
          src={helixLogo}
          alt="Helix Multi"
          className="h-20 w-20 drop-shadow-[0_0_20px_rgba(168,85,247,0.55)]"
        />
        <div className="mt-3 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-[#EC5FA3] to-[#A855F7] text-4xl font-black text-white shadow-[0_0_30px_rgba(236,95,163,0.55)]">
          {initial}
        </div>
        <h2 className="mt-3 text-xl font-black text-white">{PLAYER_MOCK.userName}</h2>
        <p className="text-sm text-white/60">{PLAYER_MOCK.userEmail}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatBox value={formatCurrency(balance)} label="SALDO" tone="green" />
        <StatBox value={String(PLAYER_MOCK.matchesPlayed)} label="PARTIDAS" tone="purple" />
        <StatBox value={formatCurrency(affiliateBalance)} label="AFILIADO" tone="yellow" />
      </div>

      <PlayerCard className="mt-4 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/60">
          <LinkIcon className="h-4 w-4 text-[#C084FC]" /> LINK DE DIVULGAÇÃO
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          <div className="flex-1 truncate px-2 text-sm text-white/85">{PLAYER_MOCK.referralUrl}</div>
          <button
            onClick={copyLink}
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] px-3 py-2 text-xs font-bold text-white shadow-[0_6px_20px_-8px_rgba(168,85,247,0.7)]"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
        </div>
      </PlayerCard>

      <PlayerCard className="mt-4 p-4">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/60">
          <Lock className="h-4 w-4 text-[#C084FC]" /> ALTERAR SENHA
        </div>
        <form onSubmit={changePassword} className="mt-3 space-y-3">
          <PasswordInput placeholder="Senha atual" value={current} onChange={setCurrent} />
          <PasswordInput placeholder="Nova senha" value={next} onChange={setNext} />
          <PasswordInput placeholder="Confirmar nova senha" value={confirm} onChange={setConfirm} />
          <GradientButton type="submit" disabled={saving} className="disabled:opacity-60">
            {saving ? "Alterando..." : "Alterar Senha"}
          </GradientButton>
        </form>
      </PlayerCard>

      <button
        onClick={logout}
        type="button"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/[0.06] py-4 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/10"
      >
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>
    </AppLayout>
  );
}

function StatBox({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "green" | "purple" | "yellow";
}) {
  const color =
    tone === "green"
      ? "text-emerald-400"
      : tone === "purple"
        ? "text-[#C084FC]"
        : "text-[#FFD600]";
  return (
    <PlayerCard className="p-3 text-center">
      <div className={`text-base font-black ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold tracking-widest text-white/60">{label}</div>
    </PlayerCard>
  );
}

function PasswordInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="password"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#A855F7]/60 focus:outline-none"
    />
  );
}
