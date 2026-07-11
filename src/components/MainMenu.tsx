import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useGameStore } from "@/store/useGameStore";
import { useThemes } from "@/hooks/useThemes";
import { useSelectedTheme } from "@/hooks/useSelectedTheme";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { useGameSession } from "@/hooks/useGameSession";
import { slugToGameTheme } from "@/lib/themeSlugMap";
import { supabase } from "@/integrations/supabase/client";
import type { GameTheme } from "@/types/theme";
import { LogoHelix } from "./LogoHelix";
import { ThemeCarousel } from "./ThemeCarousel";
import { PrimaryButton } from "./PrimaryButton";
import { ThemeProvider } from "./ThemeProvider";
const helixClassicMap = { url: "/images/helix-classic-map.png" };


export function MainMenu(_props: { onOpenThemes?: () => void; onOpenSkins?: () => void }) {
  const navigate = useNavigate();
  const startGame = useGameStore((s) => s.startGame);
  const selectGameTheme = useGameStore((s) => s.selectTheme);
  const unlockedThemes = useGameStore((s) => s.unlockedThemes);

  const { data: themes, isLoading, error } = useThemes();
  const { selectedId, selectTheme } = useSelectedTheme();
  const liveCount = useLiveMatches();
  const { startSession } = useGameSession();

  const [index, setIndex] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sync carousel index to persisted selection once themes arrive.
  useEffect(() => {
    if (!themes || themes.length === 0) return;
    const target = selectedId ?? themes.find((t) => t.is_default)?.id ?? themes[0].id;
    const idx = themes.findIndex((t) => t.id === target);
    if (idx >= 0) setIndex(idx);
  }, [themes, selectedId]);

  const current: GameTheme | undefined = useMemo(
    () => (themes && themes.length > 0 ? themes[index] : undefined),
    [themes, index],
  );

  const handleChange = (i: number) => {
    setIndex(i);
    const t = themes?.[i];
    if (t) selectTheme(t.id);
  };

  const handlePlay = async () => {
    if (!current) return;
    const gameId = slugToGameTheme(current.slug);
    if (unlockedThemes.includes(gameId)) selectGameTheme(gameId);
    await startSession(current.id);
    startGame();
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
  }

  return (
    <>
      <ThemeProvider theme={current} />
      <div
        className="pointer-events-auto absolute inset-0 z-10 h-full w-full overflow-y-auto"
        style={{
          fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
          background:
            current?.ui_config.backgroundGradient ??
            "radial-gradient(120% 80% at 50% 40%, #3a0f52 0%, #310840 30%, #21002f 65%, #180026 100%)",
          touchAction: "pan-y",
          transition: "background 0.4s ease",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(closest-side, ${current?.preview_config.cardGlow ?? "#a855f7"}55, transparent 70%)`,
            filter: "blur(4px)",
          }}
        />

        <div className="relative z-10 mx-auto flex min-h-full max-w-[900px] flex-col items-center justify-between gap-4 px-4 py-5 sm:py-6">
          <div className="flex w-full flex-col items-center gap-3">
            <LogoHelix />

            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="mx-auto flex h-11 w-[90%] max-w-[575px] items-center justify-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_30px_-10px_rgba(0,0,0,0.5)]"
              role="status"
              aria-live="polite"
            >
              <span className="relative flex h-2.5 w-2.5">
                <motion.span
                  className="absolute inset-0 rounded-full bg-emerald-400"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                />
                <span className="relative m-auto h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.9)]" />
              </span>
              <span className="text-sm font-medium tracking-tight">
                <span className="font-bold tabular-nums">{liveCount}</span> partidas ao vivo agora
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mx-auto flex w-[90%] max-w-[575px] items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 text-emerald-100 backdrop-blur-md"
              role="status"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-emerald-300" aria-hidden>
                <path fillRule="evenodd" d="M12 1.5 3 5v6c0 5 3.8 9.6 9 11 5.2-1.4 9-6 9-11V5l-9-3.5Zm4.28 8.03-5 5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L10.75 12.94l4.47-4.47a.75.75 0 1 1 1.06 1.06Z" clipRule="evenodd" />
              </svg>
              <span className="text-[12px] sm:text-[13px] font-semibold tracking-tight">
                Jogo regularizado
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-1 text-center text-[13px] sm:text-[15px] font-bold uppercase tracking-[0.35em] text-fuchsia-200/80"
            >
              Escolha seu mapa
            </motion.p>
          </div>



          <div className="flex w-full flex-col items-center gap-3 pb-3">
            <div className="relative w-full max-w-[295px] overflow-hidden rounded-[24px] border border-fuchsia-400/30 bg-[#1a0730] p-[2px] shadow-[0_0_28px_rgba(236,95,163,0.35)]">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px]">
                <img
                  src={helixClassicMap.url}
                  alt="Helix Clássico"
                  className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-center"
                  loading="eager"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              </div>
            </div>



            {userEmail ? (
              <PrimaryButton onClick={() => navigate({ to: "/app/jogar" })} aria-label="Jogar" disabled={!current}>
                JOGAR
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={handlePlay} aria-label="Jogar grátis" disabled={!current}>
                JOGAR GRATIS
              </PrimaryButton>
            )}

            {userEmail ? (
              <div className="mx-auto mt-2 flex w-full max-w-[295px] items-center justify-between gap-3">
                <span className="truncate text-xs text-white/60">{userEmail}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-medium text-white/70 underline underline-offset-4 hover:text-fuchsia-200"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="mx-auto mt-4 flex w-full max-w-[295px] items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/login" })}
                  className="h-12 sm:h-14 w-[140px] sm:w-[155px] rounded-full border border-fuchsia-400/40 bg-white/5 text-sm font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/auth" })}
                  className="text-sm font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-fuchsia-200"
                >
                  Cadastrar-se
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
