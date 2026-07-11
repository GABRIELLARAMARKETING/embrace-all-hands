import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Module-scoped state so start/finish can happen from different components.
let currentSessionId: string | null = null;
let startedAt = 0;
const SESSION_STORAGE_KEY = "helix:active-session-id";

type HelixCreateSessionResult = {
  ok?: boolean;
  session_id?: string;
  reason?: string;
};

function asHelixCreateSessionResult(value: unknown): HelixCreateSessionResult {
  return value && typeof value === "object" ? (value as HelixCreateSessionResult) : {};
}

export function hasCurrentGameSession() {
  if (currentSessionId) return true;
  if (typeof window === "undefined") return false;
  currentSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  return currentSessionId !== null;
}

function setCurrentGameSession(id: string | null) {
  currentSessionId = id;
  if (typeof window === "undefined") return;
  if (id) window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function useGameSession() {
  const queryClient = useQueryClient();
  const startSession = useCallback(async (themeId: string | null) => {
    startedAt = Date.now();
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from("game_sessions")
        .insert({ user_id: uid, theme_id: themeId, status: "started" })
        .select("id")
        .single();
      if (error) return null;
      setCurrentGameSession(data.id);
      return data.id;
    } catch {
      return null;
    }
  }, []);

  const startPaidSession = useCallback(async (depositId: string, themeId: string | null = null) => {
    startedAt = Date.now();
    try {
      const { data, error } = await supabase.rpc("helix_create_session", {
        _deposit_id: depositId,
        _theme_id: themeId ?? undefined,
      });
      if (error) return { ok: false as const, reason: error.message };

      const result = asHelixCreateSessionResult(data);
      if (!result.ok || !result.session_id) {
        return { ok: false as const, reason: result.reason ?? "session_not_created" };
      }

      setCurrentGameSession(result.session_id);
      return { ok: true as const, sessionId: result.session_id };
    } catch (error) {
      return {
        ok: false as const,
        reason: error instanceof Error ? error.message : "session_not_created",
      };
    }
  }, []);

  const finishSession = useCallback(
    async (data: { score: number; level_reached: number; status?: "finished" | "gameover" }) => {
      const id = currentSessionId;
      if (!id) return;
      const duration = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const status = data.status ?? "finished";
      try {
        // Chama o backend para finalizar (credita recompensa ou debita depósito em caso de perda).
        await supabase.rpc("helix_finish_session", {
          _session_id: id,
          _reason: status === "gameover" ? "player_lost" : "player_finished",
        });
        // Metadados auxiliares da partida (score/nível/duração) — não afetam saldo.
        await supabase
          .from("game_sessions")
          .update({
            score: data.score,
            level_reached: data.level_reached,
            duration_seconds: duration,
          })
          .eq("id", id);
      } catch {
        /* swallow */
      }
      setCurrentGameSession(null);
      // Remove dados potencialmente stale e força as telas /app/depositar,
      // /app/perfil e /app/jogar a buscarem o saldo/depósitos reais do backend.
      queryClient.removeQueries({ queryKey: ["my-profile"] });
      queryClient.removeQueries({ queryKey: ["my-deposits"] });
      queryClient.removeQueries({ queryKey: ["helix", "playable-deposit"] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["my-deposits"] }),
        queryClient.invalidateQueries({ queryKey: ["helix", "playable-deposit"] }),
      ]);
    },
    [queryClient],
  );

  return { startSession, startPaidSession, finishSession };
}
