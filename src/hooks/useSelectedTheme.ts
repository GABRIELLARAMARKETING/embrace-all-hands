import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "helix.selectedThemeId";

export function useSelectedTheme() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        supabase
          .from("user_theme_preferences")
          .select("selected_theme_id")
          .eq("user_id", uid)
          .maybeSingle()
          .then(({ data: pref }) => {
            if (!cancelled && pref?.selected_theme_id) setSelectedId(pref.selected_theme_id);
            else if (!cancelled) {
              const local = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
              if (local) setSelectedId(local);
            }
          });
      } else {
        const local = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
        if (local) setSelectedId(local);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const selectTheme = useCallback(
    async (themeId: string) => {
      setSelectedId(themeId);
      if (typeof window !== "undefined") localStorage.setItem(LS_KEY, themeId);
      if (userId) {
        await supabase
          .from("user_theme_preferences")
          .upsert({ user_id: userId, selected_theme_id: themeId }, { onConflict: "user_id" });
      }
    },
    [userId],
  );

  return { selectedId, selectTheme, userId };
}
