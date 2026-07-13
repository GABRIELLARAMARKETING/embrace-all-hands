import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/player/AppLayout";
import { PLAYER_MOCK, MAP_OPTIONS } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { cn } from "@/lib/utils";
const helixClassicMap = { url: "/images/helix-classic-map.png" };
import { getPlayableDeposit, validatePlayValue } from "@/lib/helix-play.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { useGameSession } from "@/hooks/useGameSession";
import { useGameStore } from "@/store/useGameStore";

export const Route = createFileRoute("/app/jogar")({
  head: () => ({
    meta: [
      { title: "Jogar — HelixFast" },
      { name: "description", content: "Escolha seu mapa e valor de entrada para jogar." },
    ],
  }),
  component: JogarPage,
});

function JogarPage() {
  const navigate = useNavigate();
  const setSelectedMap = usePlayerStore((s) => s.setSelectedMap);
  const value = usePlayerStore((s) => s.selectedPlayValue);
  const setValue = usePlayerStore((s) => s.setSelectedPlayValue);
  const startGame = useGameStore((s) => s.startGame);
  const { startPaidSession, startDemoSession } = useGameSession();

  // Fonte oficial: backend valida se existe depósito confirmado e qual saldo o
  // usuário ainda pode usar em partidas.
  const fetchPlayable = useServerFn(getPlayableDeposit);
  const playable = useQuery({
    queryKey: ["helix", "playable-deposit"],
    queryFn: () => fetchPlayable(),
    // Sempre revalida ao entrar na rota — o depósito jogável pode ter sido
    // criado/consumido enquanto o usuário estava em outra tela.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const referenceDepositId = playable.data?.ok ? playable.data.depositId : null;

  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    refetchOnMount: "always",
  });
  const balance = profileQuery.data?.balance ?? 0;
  const isDemo = !!profileQuery.data?.isDemo;
  const demoBalance = profileQuery.data?.demoBalance ?? 0;
  const roles = profileQuery.data?.roles ?? [];
  const primaryRole =
    roles.find((r) => r === "super_admin") ??
    roles.find((r) => r === "admin") ??
    roles.find((r) => r === "gerente") ??
    roles.find((r) => r === "afiliado") ??
    roles[0] ??
    "jogador";
  const roleLabel: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    gerente: "Gerente",
    afiliado: "Afiliado",
    jogador: "Jogador",
  };
  const effectiveBalance = isDemo ? demoBalance : balance;


  // Garante que o valor selecionado continue cabendo no saldo atual — apenas
  // depois que o perfil terminou de carregar; durante o loading effectiveBalance=0
  // e resetaria o valor recém-clicado indevidamente.
  useEffect(() => {
    if (!profileQuery.isSuccess) return;
    if (value != null && effectiveBalance < value) {
      setValue(null);
    }
  }, [profileQuery.isSuccess, effectiveBalance, value, setValue]);

  // Apenas o mapa clássico está disponível nesta rota.
  const availableMaps = useMemo(
    () => MAP_OPTIONS.filter((m) => m.id === "classico"),
    [],
  );
  const selectedMap = availableMaps[0];
  // Regra oficial (backend): saque mínimo = 5x o valor da entrada escolhida.
  const effectiveValue = value;
  const minWithdraw = effectiveValue ? effectiveValue * 5 : 0;
  const maxEntry = Math.max(0, Math.floor(effectiveBalance * 100) / 100);
  const setEntryValue = (raw: string) => {
    if (!raw.trim()) {
      setValue(null);
      return;
    }
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setValue(null);
      return;
    }
    const centsValue = Math.floor(parsed * 100) / 100;
    setValue(Math.min(centsValue, maxEntry));
  };
  // Habilita JOGAR: em modo demo, quando um valor válido cabe no demo_balance;
  // em modo real, quando o valor cabe no saldo (backend valida se há depósito confirmado).
  const canPlay = isDemo
    ? effectiveValue != null && effectiveValue > 0 && demoBalance >= effectiveValue
    : profileQuery.isSuccess && effectiveValue != null && effectiveValue > 0 && balance >= effectiveValue;


  // Revalidação server-side no clique de JOGAR (defesa em profundidade).
  const validateFn = useServerFn(validatePlayValue);
  const [validating, setValidating] = useState(false);
  const handlePlay = async () => {
    if (validating) return;
    setValidating(true);
    try {
      if (isDemo) {
        if (!effectiveValue || demoBalance < effectiveValue) {
          toast.error("Saldo demo insuficiente para esta entrada.");
          return;
        }
        const session = await startDemoSession(effectiveValue);
        if (!session.ok) {
          toast.error(
            session.reason === "insufficient_demo_balance"
              ? "Saldo demo insuficiente."
              : session.reason === "demo_session_already_active"
                ? "Você já tem uma partida demo em andamento."
                : session.reason === "unsupported_amount"
                  ? "Valor de entrada não suportado."
                  : "Não foi possível iniciar a partida demo.",
          );
          await profileQuery.refetch();
          return;
        }
        startGame();
        navigate({ to: "/game" });
        return;
      }

      if (!effectiveValue) return;
      const res = await validateFn({ data: { amount: effectiveValue } });
      if (!res.ok) {
        toast.error(
          res.reason === "insufficient_balance"
            ? "Saldo insuficiente para esta entrada."
            : res.reason === "unsupported_amount"
              ? "Valor de entrada não suportado."
              : res.reason === "no_playable_deposit"
                ? "Nenhum depósito confirmado disponível para jogar."
                : "Depósito indisponível para jogar.",
        );
        await playable.refetch();
        await profileQuery.refetch();
        return;
      }
      const session = await startPaidSession(res.depositId, effectiveValue);

      if (!session.ok) {
        console.error("[helix] startPaidSession failed", { reason: session.reason, depositId: res.depositId, amount: effectiveValue });
        toast.error(
          session.reason === "insufficient_balance"
            ? "Saldo insuficiente para esta entrada."
            : session.reason === "session_already_active"
              ? "Você já tem uma partida em andamento."
              : session.reason === "deposit_not_found"
                ? "Depósito de referência não encontrado."
                : session.reason === "deposit_not_paid"
                  ? "Depósito de referência não está pago."
                  : session.reason === "deposit_not_credited"
                    ? "Depósito de referência não creditado."
                    : session.reason === "unsupported_amount"
                      ? "Valor de entrada não suportado."
                      : `Não foi possível iniciar a partida (${session.reason ?? "desconhecido"}).`,
        );

        await playable.refetch();
        await profileQuery.refetch();
        return;
      }
      startGame();
      navigate({ to: "/game" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao validar depósito.");
    } finally {
      setValidating(false);
    }
  };




  return (
    <AppLayout>
      <div className="relative mt-4 overflow-hidden rounded-[28px] border border-[#3a1d5a]/70 bg-[#120726]/85 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        {/* Top gradient band */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#4a1d7a]/60 to-transparent" />

        <div className="relative p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#F472B6] to-[#8B1FB0] shadow-[0_0_24px_rgba(236,95,163,0.55)]">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 4v5h-5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="truncate text-lg font-extrabold text-white">{PLAYER_MOCK.userName}</h2>
              <p className="text-[13px] text-white/55">Escolha seu mapa e jogue</p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-[#0d1a15] px-3 py-1.5 text-[12px] font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00D084]" />
              <span className="font-black text-white">{PLAYER_MOCK.onlineUsers}</span>
              <span className="text-emerald-300/90">online</span>
            </div>
          </div>

          {/* Indicador de saldo disponível + papel — confirma qual valor será usado como stake */}
          <div className="mt-5 rounded-2xl border border-[#3a1d5a] bg-gradient-to-br from-[#1a0c30] to-[#150a28] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-[0.22em] text-[#B47CFF]">
                  {isDemo ? "SALDO DEMO DISPONÍVEL" : "SALDO DISPONÍVEL PARA STAKE"}
                </div>
                <div
                  className={cn(
                    "mt-1 text-2xl font-black drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]",
                    isDemo ? "text-emerald-300" : "text-emerald-400",
                  )}
                  data-testid="available-balance"
                >
                  {profileQuery.isLoading ? "—" : formatCurrency(effectiveBalance)}
                </div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  {isDemo
                    ? "Saldo demo — não sacável"
                    : "Valor creditado na carteira usado como stake da partida"}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-black tracking-widest uppercase",
                    primaryRole === "gerente"
                      ? "border-amber-400/60 bg-amber-500/10 text-amber-300"
                      : primaryRole === "admin" || primaryRole === "super_admin"
                        ? "border-rose-400/60 bg-rose-500/10 text-rose-300"
                        : primaryRole === "afiliado"
                          ? "border-sky-400/60 bg-sky-500/10 text-sky-300"
                          : "border-white/20 bg-white/5 text-white/70",
                  )}
                  data-testid="user-role-badge"
                >
                  {roleLabel[primaryRole] ?? primaryRole}
                </span>
                {isDemo && (
                  <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    DEMO
                  </span>
                )}
              </div>
            </div>
            {effectiveValue != null && effectiveValue > 0 && (
              <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-white/70">
                Stake selecionado:{" "}
                <span className="font-bold text-white">{formatCurrency(effectiveValue)}</span>{" "}
                · Restante após entrada:{" "}
                <span className="font-bold text-white">
                  {formatCurrency(Math.max(0, effectiveBalance - effectiveValue))}
                </span>
              </div>
            )}
          </div>



          {/* Valor de entrada */}
          <div className="mt-6 text-[11px] font-bold tracking-widest text-[#B47CFF]">
            VALOR DE ENTRADA
          </div>
          <div className="mt-3 rounded-2xl border border-[#3a1d5a] bg-[#150a28] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white/75">R$</span>
              <input
                value={effectiveValue ?? ""}
                onChange={(event) => setEntryValue(event.currentTarget.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="min-w-0 flex-1 bg-transparent text-3xl font-black text-white outline-none placeholder:text-white/25"
              />
            </div>
            <div className="mt-1 text-[11px] font-semibold text-white/50">
              Disponível: {formatCurrency(maxEntry)}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAYER_MOCK.playOptions.map((v) => {
              const active = effectiveValue === v;
              const affordable = effectiveBalance >= v;
              return (
                <button
                  key={v}
                  type="button"
                  title={affordable ? undefined : "Acima do saldo — ajuste no campo acima"}
                  onClick={() => setValue(v)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-bold transition-all",
                    active
                      ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_0_18px_rgba(168,85,247,0.55)]"
                      : affordable
                        ? "border border-[#3a1d5a] bg-[#1a0c30] text-white hover:border-[#5b2e8a]"
                        : "border border-[#3a1d5a]/60 bg-[#1a0c30]/60 text-white/60 hover:border-[#5b2e8a]",
                  )}
                >
                  R${v}
                </button>
              );
            })}
          </div>
          {isDemo ? (
            <div className="mt-2 text-[11px] font-semibold text-emerald-300/90">
              Modo demo — saldo demo {formatCurrency(demoBalance)} (não sacável).
            </div>
          ) : (
            !profileQuery.isLoading && balance <= 0 && (
              <div className="mt-2 text-[11px] font-semibold text-amber-300/90">
                Saldo zerado. Faça um depósito para liberar o jogo.
              </div>
            )
          )}






          {/* Recompensa mínima para saque */}
          <div className="mt-4 rounded-2xl border border-[#3a1d5a] bg-[#150a28] px-5 py-4 text-center">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-white/60">
              RECOMPENSA MÍNIMA PARA SAQUE
            </div>
            <div className="mt-1 text-3xl font-black text-[#FFD600] drop-shadow-[0_0_14px_rgba(255,214,0,0.55)]">
              {formatCurrency(minWithdraw)}
            </div>
            {effectiveValue ? (
              <div className="mt-1 text-[11px] text-white/55">
                Entrada de {formatCurrency(effectiveValue)} · sacar só ao atingir{" "}
                {formatCurrency(minWithdraw)}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-white/45">
                Faça um depósito para desbloquear o jogo
              </div>
            )}
          </div>


          {/* Mapa */}
          <div className="mt-6 text-[11px] font-bold tracking-widest text-[#B47CFF]">MAPA</div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setSelectedMap(selectedMap.id)}
              aria-label={selectedMap.name}
              className="group relative block w-full rounded-[26px] p-[2px] bg-gradient-to-br from-[#F472B6] via-[#EC5FA3] to-[#A855F7] shadow-[0_0_28px_rgba(236,95,163,0.45)] transition-transform active:scale-[0.99]"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px] border border-black/40 bg-[#1a0730]">
                <img
                  src={helixClassicMap.url}
                  alt={selectedMap.name}
                  className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-center"
                  loading="eager"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                  <div className="text-[10px] font-bold tracking-[0.3em] text-white/75">MAPA</div>
                  <div className="mt-0.5 text-lg font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
                    {selectedMap.name}
                  </div>
                </div>
              </div>
            </button>
          </div>



          {/* Play button */}
          <button
            disabled={!canPlay || validating}
            onClick={handlePlay}
            className={cn(
              "mt-5 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15px] font-bold transition-all",
              canPlay && !validating
                ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_10px_30px_-10px_rgba(236,95,163,0.7)] active:scale-[0.98]"
                : "cursor-not-allowed border border-[#3a1d5a] bg-[#1a0c30] text-white/45",
            )}
          >
            <Play className="h-4 w-4 fill-current" />
            {validating ? "VALIDANDO..." : `JOGAR — ${formatCurrency(effectiveValue ?? 0)}`}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
