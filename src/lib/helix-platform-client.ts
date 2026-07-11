import { supabase } from "@/integrations/supabase/client";
import { getCurrentGameSessionId } from "@/hooks/useGameSession";

const pendingPlatformRegistrations = new Set<Promise<unknown>>();

export function registerHelixPlatform(platformIndex: number) {
  const sessionId = getCurrentGameSessionId();
  if (!sessionId) return;

  const request = supabase
    .rpc("helix_register_platform", {
      _session_id: sessionId,
      _platform_index: platformIndex,
      _client_ts: Date.now(),
      _event_hash: `${sessionId}:${platformIndex}`,
    })
    .then(({ error }) => {
      if (error) console.error("[helix] platform registration failed", error);
    })
    .catch((error) => {
      console.error("[helix] platform registration threw", error);
    })
    .finally(() => {
      pendingPlatformRegistrations.delete(request);
    });

  pendingPlatformRegistrations.add(request);
}

export async function waitForPendingHelixPlatforms() {
  if (pendingPlatformRegistrations.size === 0) return;
  await Promise.allSettled(Array.from(pendingPlatformRegistrations));
}