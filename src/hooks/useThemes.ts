import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GameTheme } from "@/types/theme";

async function fetchThemes(): Promise<GameTheme[]> {
  const { data, error } = await supabase
    .from("game_themes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as GameTheme[];
}

export function useThemes() {
  return useQuery({
    queryKey: ["game_themes"],
    queryFn: fetchThemes,
    staleTime: 5 * 60_000,
  });
}
