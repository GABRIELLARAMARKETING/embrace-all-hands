import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getHelixDifficulty } from "@/lib/helix-difficulty.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_HELIX_CONFIG,
  clampSettings,
  helixRuntime,
  settingsForDifficulty,
  type HelixDifficulty,
  type HelixDifficultyConfig,
  type HelixSettings,
} from "@/game/config/difficulty";

/**
 * Loads the Helix difficulty and keeps it live for all connected players:
 *   1. Query hydrates the runtime on mount (SSR-safe fallback = Normal).
 *   2. Supabase Realtime subscription to `platform_settings` pushes updates
 *      immediately when an admin publishes (no wait for polling).
 *   3. Polling (10s) is kept as a safety net in case the socket drops.
 */
export function useHelixDifficultyLoader() {
  const fn = useServerFn(getHelixDifficulty);
  const qc = useQueryClient();
  const query = useQuery<HelixDifficultyConfig>({
    queryKey: ["helix", "difficulty"],
    queryFn: () => fn(),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) helixRuntime.set(query.data);
    else helixRuntime.set(DEFAULT_HELIX_CONFIG);
  }, [query.data]);

  useEffect(() => {
    const channel = supabase
      .channel("helix-difficulty-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_settings",
          filter: "key=eq.helix_difficulty",
        },
        (payload) => {
          const raw = (payload.new as { value?: unknown } | null)?.value as
            | { difficulty?: HelixDifficulty; settings?: Partial<HelixSettings> }
            | undefined;
          if (!raw) return;
          const difficulty: HelixDifficulty =
            raw.difficulty &&
            ["easy", "normal", "hard", "extreme", "insane", "nightmare", "custom"].includes(
              raw.difficulty,
            )
              ? raw.difficulty
              : "normal";
          const settings =
            difficulty === "custom"
              ? clampSettings(raw.settings ?? {})
              : settingsForDifficulty(difficulty);
          const next: HelixDifficultyConfig = { difficulty, settings };
          helixRuntime.set(next);
          qc.setQueryData(["helix", "difficulty"], next);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}
