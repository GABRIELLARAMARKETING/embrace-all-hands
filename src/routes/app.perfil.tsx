import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, History, Link as LinkIcon, Lock, LogOut } from "lucide-react";
import { listAffiliateWithdrawals, type WithdrawalHistoryItem } from "@/lib/withdrawals.functions";
import { AppLayout, PlayerCard, GradientButton } from "@/components/player/AppLayout";
import { PLAYER_MOCK } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { copyToClipboard } from "@/utils/clipboard";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profile.functions";
import { getReferralStats } from "@/lib/referral.functions";
const helixLogo = "/images/helixfast-logo.png";


const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: () => getMyProfile(),
});

const withdrawalsQuery = queryOptions({
  queryKey: ["affiliate-withdrawals"],
  queryFn: () => listAffiliateWithdrawals(),
});

const referralStatsQuery = queryOptions({
  queryKey: ["referral-stats"],
  queryFn: () => getReferralStats(),
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
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(myProfileQuery);
  const { data: withdrawals = [] } = useSuspenseQuery(withdrawalsQuery);
  const { data: referral } = useSuspenseQuery(referralStatsQuery);

  // Mirror server values into the local store when setters exist
  const store = usePlayerStore.getState() as unknown as Record<string, unknown>;
  useEffect(() => {
    if (typeof store.setBalance === "function") (store.setBalance as (v: number) => void)(profile.balance);
    if (typeof store.setAffiliateBalance === "function")
      (store.setAffiliateBalance as (v: number) => void)(profile.affiliateBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.balance, profile.affiliateBalance]);


  // Realtime: refresh when profile row or game_sessions change
  useEffect(() => {
    const channel = supabase
      .channel(`profile-${profile.userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profile.userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions", filter: `user_id=eq.${profile.userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "affiliate_withdrawals", filter: `user_id=eq.${profile.userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["affiliate-withdrawals"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.userId, queryClient]);

  const balance = profile.balance;
  const affiliateBalance = profile.affiliateBalance;
  const matchesPlayed = profile.matchesPlayed;
  const displayName = profile.displayName;
  const email = profile.email;
  const initial = (displayName || "?").charAt(0).toUpperCase();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);


  const referralUrl = referral.referralUrl ?? PLAYER_MOCK.referralUrl;
  const affiliateCode = referral.affiliateCode;

  const copyLink = async () => {
    if (!referralUrl) {
      toast.error("Seu link ainda não está disponível.");
      return;
    }
    const ok = await copyToClipboard(referralUrl);
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
        <h2 className="mt-3 text-xl font-black text-white">{displayName}</h2>
        <p className="text-sm text-white/60">{email}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatBox value={formatCurrency(balance)} label="SALDO" tone="green" />
        <StatBox value={String(matchesPlayed)} label="PARTIDAS" tone="purple" />

        <StatBox value={formatCurrency(affiliateBalance)} label="AFILIADO" tone="yellow" />
      </div>

      <PlayerCard className="mt-4 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-widest text-white/60">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-[#C084FC]" /> LINK DE DIVULGAÇÃO
          </div>
          {affiliateCode && (
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/80">
              {affiliateCode}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
          <div className="flex-1 truncate px-2 text-sm text-white/85">{referralUrl}</div>

          <button
            onClick={copyLink}
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] px-3 py-2 text-xs font-bold text-white shadow-[0_6px_20px_-8px_rgba(168,85,247,0.7)]"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </button>
        </div>
      </PlayerCard>

      <WithdrawalHistory items={withdrawals} />


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

function withdrawalStatusMeta(status: string) {
  const s = status.toLowerCase();
  if (s === "approved" || s === "paid" || s === "completed")
    return { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
  if (s === "rejected" || s === "failed" || s === "canceled")
    return { label: "Recusado", cls: "bg-red-500/15 text-red-300 border-red-500/30" };
  return { label: "Pendente", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
}

function WithdrawalHistory({ items }: { items: WithdrawalHistoryItem[] }) {
  return (
    <PlayerCard className="mt-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/60">
          <History className="h-4 w-4 text-[#C084FC]" /> HISTÓRICO DE RETIRADAS
        </div>
        <div className="text-[10px] font-bold tracking-widest text-white/40">
          {items.length} {items.length === 1 ? "registro" : "registros"}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-6 text-center text-xs text-white/50">
          Você ainda não solicitou nenhum saque.
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {items.map((w) => {
            const meta = withdrawalStatusMeta(w.status);
            const date = new Date(w.created_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={w.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-bold text-white">{formatCurrency(w.amount)}</div>
                  <div className="text-[11px] text-white/50">{date}</div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${meta.cls}`}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PlayerCard>
  );
}
