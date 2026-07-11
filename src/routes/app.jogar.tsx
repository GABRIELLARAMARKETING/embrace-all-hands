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
  const { startPaidSession } = useGameSession();

  // Fonte oficial: backend valida qual valor o usuário pode jogar (baseado no
  // último depósito pago e ainda não usado em uma sessão).
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
  const serverAmount = playable.data?.ok ? playable.data.amount : null;

  const fetchProfile = useServerFn(getMyProfile);
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    refetchOnMount: "always",
  });
  const balance = profileQuery.data?.balance ?? 0;


  // Diagnóstico rápido no console — inspecionar em DevTools ao abrir /app/jogar.
  useEffect(() => {
    if (playable.data) {
      // eslint-disable-next-line no-console
      console.log("[HELIX playable-deposit]", playable.data);
    }
  }, [playable.data]);

  // Sincroniza store com o valor autoritativo do backend; rejeita divergências.
  useEffect(() => {
    if (serverAmount != null && value !== serverAmount) {
      setValue(serverAmount);
    }
  }, [serverAmount, value, setValue]);

  // Apenas o mapa clássico está disponível nesta rota.
  const availableMaps = useMemo(
    () => MAP_OPTIONS.filter((m) => m.id === "classico"),
    [],
  );
  const selectedMap = availableMaps[0];
  // Regra oficial (backend): saque mínimo = 5x o valor do depósito.
  const effectiveValue = serverAmount ?? value ?? null;
  const minWithdraw = effectiveValue ? effectiveValue * 5 : 0;
  // Só habilita JOGAR quando o backend confirmou um depósito jogável.
  const canPlay = playable.isSuccess && !!serverAmount && !playable.isFetching;

  // Revalidação server-side no clique de JOGAR (defesa em profundidade).
  const validateFn = useServerFn(validatePlayValue);
  const [validating, setValidating] = useState(false);
  const handlePlay = async () => {
    if (!serverAmount || validating) return;
    setValidating(true);
    try {
      const res = await validateFn({ data: { amount: serverAmount } });
      if (!res.ok) {
        toast.error(
          res.reason === "amount_mismatch"
            ? "Valor não corresponde ao seu depósito."
            : res.reason === "deposit_already_used"
              ? "Este depósito já foi usado em uma partida."
              : "Depósito indisponível para jogar.",
        );
        await playable.refetch();
        return;
      }
      const session = await startPaidSession(res.depositId);
      if (!session.ok) {
        toast.error(
          session.reason === "deposit_already_used"
            ? "Este depósito já foi usado em uma partida."
            : "Não foi possível iniciar a partida.",
        );
        await playable.refetch();
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

          {/* Valor de entrada — travado no depósito real do usuário (backend) */}
          <div className="mt-6 text-[11px] font-bold tracking-widest text-[#B47CFF]">
            VALOR DE ENTRADA
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLAYER_MOCK.playOptions.map((v) => {
              const active = effectiveValue === v;
              return (
                <button
                  key={v}
                  onClick={() => setValue(v)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-bold transition-all",
                    active
                      ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_0_18px_rgba(168,85,247,0.55)]"
                      : "border border-[#3a1d5a] bg-[#1a0c30] text-white hover:border-[#5b2e8a]",
                  )}
                >
                  R${v}
                </button>
              );
            })}
          </div>
          {!playable.isLoading && !serverAmount && (
            <div className="mt-2 text-[11px] font-semibold text-amber-300/90">
              Nenhum depósito disponível para jogar. Faça um depósito para liberar.
            </div>
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
                Depósito de {formatCurrency(effectiveValue)} · sacar só ao atingir{" "}
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
            {validating ? "VALIDANDO..." : `JOGAR — ${formatCurrency(serverAmount ?? 0)}`}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
