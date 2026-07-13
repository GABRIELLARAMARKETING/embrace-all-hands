import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, VolumeX, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listAdminNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification,
} from "@/lib/admin-notifications.functions";
import {
  categoryFromType,
  loadPrefs,
  playNotificationSound,
  savePrefs,
  unlockAudio,
} from "@/lib/admin-notification-sound";
import { formatDate } from "@/utils/formatDate";

/** Sino de notificações no header do painel admin com dropdown e som. */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => loadPrefs().enabled && loadPrefs().unlocked);
  const dropRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => listAdminNotifications(),
    staleTime: 10_000,
  });

  const unread = rows.filter((r) => !r.read_at);

  // Marca as notificações iniciais como "já vistas" para não tocar som no primeiro carregamento.
  useEffect(() => {
    rows.forEach((r) => seenRef.current.add(r.id));
    // Executa apenas 1x com dados iniciais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!dropRef.current) return;
      if (!dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // Realtime + toast + som para novas notificações.
  useEffect(() => {
    const ch = supabase
      .channel("admin-bell-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        (payload) => {
          const row = payload.new as AdminNotification;
          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
          void playNotificationSound({
            category: categoryFromType(row.type),
            severity: row.severity,
          });
          const fn =
            row.severity === "critical" || row.severity === "error"
              ? toast.error
              : row.severity === "warning"
                ? toast.warning
                : row.severity === "success"
                  ? toast.success
                  : toast.info;
          fn(row.title, {
            description: row.message ?? undefined,
            duration: row.severity === "critical" ? Infinity : 6000,
            action: {
              label: "Ver",
              onClick: () => {
                setOpen(true);
              },
            },
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const handleToggleSound = async () => {
    const prefs = loadPrefs();
    if (!prefs.unlocked) {
      const ok = await unlockAudio();
      if (!ok) {
        toast.error("Não foi possível ativar sons neste navegador.");
        return;
      }
    }
    const next = !prefs.enabled;
    savePrefs({ ...loadPrefs(), enabled: next });
    setEnabled(next && loadPrefs().unlocked);
    toast.success(next ? "Sons ativados" : "Sons silenciados");
  };

  const handleMarkOne = async (id: string) => {
    await markNotificationRead({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    toast.success("Todas marcadas como lidas");
  };

  return (
    <div className="relative" ref={dropRef}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggleSound}
          className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08]"
          title={enabled ? "Silenciar sons" : "Ativar sons de notificação"}
          aria-label={enabled ? "Silenciar sons" : "Ativar sons"}
        >
          {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.08]"
          aria-label={`Notificações (${unread.length} não lidas)`}
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1a] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">Notificações</div>
              <div className="text-xs text-white/50">{unread.length} não lida{unread.length === 1 ? "" : "s"}</div>
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unread.length === 0}
              className="text-xs text-cyan-300 hover:underline disabled:opacity-40"
            >
              Marcar todas
            </button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {rows.length === 0 && (
              <li className="p-6 text-center text-sm text-white/40">Sem notificações.</li>
            )}
            {rows.slice(0, 12).map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-2 border-b border-white/5 px-4 py-3 text-sm ${
                  n.read_at ? "opacity-60" : "bg-white/[0.02]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{n.title}</div>
                  {n.message && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-white/60">{n.message}</div>
                  )}
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
                    {formatDate(n.created_at)}
                  </div>
                </div>
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => handleMarkOne(n.id)}
                    className="shrink-0 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    title="Marcar como lida"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-white/5 px-4 py-2 text-center">
            <Link
              to="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-cyan-300 hover:underline"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
