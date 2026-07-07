import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useGameSession() {
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);

  const startSession = useCallback(async (themeId: string | null) => {
    startedAtRef.current = Date.now();
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
      sessionIdRef.current = data.id;
      return data.id;
    } catch {
      return null;
    }
  }, []);

  const finishSession = useCallback(
    async (data: { score: number; level_reached: number; status?: "finished" | "gameover" }) => {
      const id = sessionIdRef.current;
      if (!id) return;
      const duration = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
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
      sessionIdRef.current = null;
    },
    [],
  );

  return { startSession, finishSession };
}
