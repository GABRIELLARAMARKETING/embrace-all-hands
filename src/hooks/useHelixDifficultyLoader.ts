import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getHelixDifficulty } from "@/lib/helix-difficulty.functions";
import {
  DEFAULT_HELIX_CONFIG,
  helixRuntime,
  type HelixDifficultyConfig,
} from "@/game/config/difficulty";

/**
 * Carrega a configuração de dificuldade do Helix e a injeta no runtime singleton
 * consumido pelo GameCanvas e pela store. Em caso de falha, mantém DEFAULT (Normal).
 */
export function useHelixDifficultyLoader() {
  const fn = useServerFn(getHelixDifficulty);
  const query = useQuery<HelixDifficultyConfig>({
    queryKey: ["helix", "difficulty"],
    queryFn: () => fn(),
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (query.data) helixRuntime.set(query.data);
    else helixRuntime.set(DEFAULT_HELIX_CONFIG);
  }, [query.data]);

  return query;
}
