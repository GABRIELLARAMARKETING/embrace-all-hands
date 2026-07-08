import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Subscribe to Postgres changes on a table and invalidate related React Query
 * caches so admin views update in real time.
 */
export function useAdminRealtime(opts: {
  table: "affiliate_withdrawals" | "risk_alerts";
  invalidateKeys: Array<readonly unknown[]>;
  toastOnInsert?: (payload: Record<string, unknown>) => string | null;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`admin-${opts.table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: opts.table },
        (payload) => {
          for (const key of opts.invalidateKeys) {
            qc.invalidateQueries({ queryKey: key as unknown[] });
          }
          if (payload.eventType === "INSERT" && opts.toastOnInsert) {
            const msg = opts.toastOnInsert(payload.new as Record<string, unknown>);
            if (msg) toast.info(msg);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.table]);
}
