import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Module-scoped state so start/finish can happen from different components.
let currentSessionId: string | null = null;
let startedAt = 0;

export function useGameSession() {
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
      currentSessionId = data.id;
      return data.id;
    } catch {
      return null;
    }
  }, []);

  const finishSession = useCallback(
    async (data: { score: number; level_reached: number; status?: "finished" | "gameover" }) => {
      const id = currentSessionId;
      if (!id) return;
      const duration = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      try {
        await supabase
          .from("game_sessions")
          .update({
            score: data.score,
            level_reached: data.level_reached,
            duration_seconds: duration,
            status: data.status ?? "finished",
            finished_at: new Date().toISOString(),
          })
          .eq("id", id);
      } catch {
        /* swallow */
      }
      currentSessionId = null;
    },
    [],
  );

  return { startSession, finishSession };
}
