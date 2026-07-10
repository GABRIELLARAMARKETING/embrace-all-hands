import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation, queryOptions } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, XCircle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AdminNotification,
} from "@/lib/admin-notifications.functions";
import { formatDate } from "@/utils/formatDate";

const notifQuery = queryOptions({
  queryKey: ["admin", "notifications"],
  queryFn: () => listAdminNotifications(),
  staleTime: 10_000,
});

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Notificações · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(notifQuery),
  component: Page,
});

function severityStyle(sev: AdminNotification["severity"]) {
  switch (sev) {
    case "critical": return { icon: AlertOctagon, cls: "text-red-300 border-red-500/40 bg-red-500/10" };
    case "error": return { icon: XCircle, cls: "text-red-300 border-red-500/30 bg-red-500/5" };
    case "warning": return { icon: AlertTriangle, cls: "text-amber-300 border-amber-500/30 bg-amber-500/5" };
    case "success": return { icon: CheckCircle2, cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5" };
    default: return { icon: Info, cls: "text-cyan-200 border-cyan-500/30 bg-cyan-500/5" };
  }
}

function Page() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(notifQuery);

  useEffect(() => {
    const ch = supabase
      .channel("admin-notifications-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
          if (payload.eventType === "INSERT") {
            const row = payload.new as { severity: string; title: string };
            const fn = row.severity === "critical" || row.severity === "error"
              ? toast.error
              : row.severity === "warning"
                ? toast.warning
                : toast.info;
            fn(row.title);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      toast.success("Todas marcadas como lidas");
    },
  });

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Central de Notificações</h1>
          <p className="text-sm text-white/50">
            {unread} não lida{unread === 1 ? "" : "s"} · atualização em tempo real
          </p>
        </div>
        <button
          onClick={() => markAll.mutate()}
          disabled={unread === 0 || markAll.isPending}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08] disabled:opacity-50"
        >
          Marcar todas como lidas
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/40">
          Sem notificações no momento.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const { icon: Icon, cls } = severityStyle(n.severity);
            const unreadRow = !n.read_at;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 rounded-xl border p-4 ${cls} ${unreadRow ? "ring-1 ring-cyan-400/30" : "opacity-70"}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-medium text-white">{n.title}</div>
                    <div className="shrink-0 text-xs text-white/40">{formatDate(n.created_at)}</div>
                  </div>
                  {n.message && <div className="mt-1 text-sm text-white/60">{n.message}</div>}
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-white/40">
                    {n.type}
                  </div>
                </div>
                {unreadRow && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    className="shrink-0 rounded-md border border-white/10 p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                    title="Marcar como lida"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
