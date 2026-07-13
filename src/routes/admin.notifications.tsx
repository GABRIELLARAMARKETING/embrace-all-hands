import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  DollarSign,
  Info,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  Undo2,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  XCircle,
  Check,
  Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteAdminNotification,
  listAdminNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  type AdminNotification,
} from "@/lib/admin-notifications.functions";
import {
  categoryFromType,
  loadPrefs,
  playNotificationSound,
  savePrefs,
  testSound,
  unlockAudio,
  type NotifCategory,
  type SoundPrefs,
} from "@/lib/admin-notification-sound";
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

type SeverityKey = AdminNotification["severity"];

const SEVERITY_META: Record<
  SeverityKey,
  { label: string; icon: typeof Info; cls: string; priorityLabel: string; sortWeight: number }
> = {
  critical: { label: "Crítica", icon: AlertOctagon, cls: "text-red-300 border-red-500/40 bg-red-500/10", priorityLabel: "Crítica", sortWeight: 0 },
  error: { label: "Erro", icon: XCircle, cls: "text-red-300 border-red-500/30 bg-red-500/5", priorityLabel: "Alta", sortWeight: 1 },
  warning: { label: "Alerta", icon: AlertTriangle, cls: "text-amber-300 border-amber-500/30 bg-amber-500/5", priorityLabel: "Alta", sortWeight: 2 },
  success: { label: "Sucesso", icon: CheckCircle2, cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5", priorityLabel: "Normal", sortWeight: 3 },
  info: { label: "Info", icon: Info, cls: "text-cyan-200 border-cyan-500/30 bg-cyan-500/5", priorityLabel: "Baixa", sortWeight: 4 },
};

const CATEGORY_META: Record<NotifCategory, { label: string; icon: typeof Info }> = {
  financial: { label: "Financeiro", icon: DollarSign },
  user: { label: "Usuários", icon: Users },
  affiliate: { label: "Afiliados", icon: UserPlus },
  manager: { label: "Gerentes", icon: ShieldAlert },
  support: { label: "Suporte", icon: Bell },
  system: { label: "Sistema", icon: AlertTriangle },
};

type FilterCategory = NotifCategory | "all";
type FilterStatus = "all" | "unread" | "read";
type FilterPriority = "all" | SeverityKey;

function Page() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(notifQuery);

  const [category, setCategory] = useState<FilterCategory>("all");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [priority, setPriority] = useState<FilterPriority>("all");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<SoundPrefs>(() => loadPrefs());

  // Realtime + sons + toasts.
  useEffect(() => {
    const seen = new Set(rows.map((r) => r.id));
    const ch = supabase
      .channel("admin-notifications-page-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_notifications" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
          if (payload.eventType === "INSERT") {
            const row = payload.new as AdminNotification;
            if (seen.has(row.id)) return;
            seen.add(row.id);
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
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });
  const unmarkOne = useMutation({
    mutationFn: (id: string) => markNotificationUnread({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });
  const removeOne = useMutation({
    mutationFn: (id: string) => deleteAdminNotification({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      toast.success("Notificação removida");
    },
  });
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      toast.success("Todas marcadas como lidas");
    },
  });

  const counts = useMemo(() => {
    const c = { unread: 0, financial: 0, user: 0, affiliate: 0, manager: 0, support: 0, system: 0 } as Record<string, number>;
    for (const r of rows) {
      if (!r.read_at) c.unread++;
      c[categoryFromType(r.type)]++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (category === "all" ? true : categoryFromType(r.type) === category))
      .filter((r) => (status === "all" ? true : status === "unread" ? !r.read_at : !!r.read_at))
      .filter((r) => (priority === "all" ? true : r.severity === priority))
      .filter((r) => {
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          (r.message ?? "").toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          JSON.stringify(r.payload ?? {}).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aw = SEVERITY_META[a.severity].sortWeight;
        const bw = SEVERITY_META[b.severity].sortWeight;
        if (aw !== bw) return aw - bw;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [rows, category, status, priority, search]);

  const updatePrefs = (patch: Partial<SoundPrefs>) => {
    const next = { ...loadPrefs(), ...patch };
    savePrefs(next);
    setPrefs(next);
  };

  const handleUnlock = async () => {
    const ok = await unlockAudio();
    if (ok) {
      setPrefs(loadPrefs());
      toast.success("Sons ativados neste navegador");
    } else {
      toast.error("Não foi possível ativar sons.");
    }
  };

  const summaryCards: Array<{ key: FilterCategory; label: string; value: number; icon: typeof Bell; accent: string }> = [
    { key: "all", label: "Não lidas", value: counts.unread, icon: Bell, accent: "text-cyan-300" },
    { key: "financial", label: "Financeiro", value: counts.financial, icon: DollarSign, accent: "text-emerald-300" },
    { key: "user", label: "Usuários", value: counts.user, icon: Users, accent: "text-sky-300" },
    { key: "affiliate", label: "Afiliados", value: counts.affiliate, icon: UserPlus, accent: "text-violet-300" },
    { key: "manager", label: "Gerentes", value: counts.manager, icon: ShieldAlert, accent: "text-amber-300" },
    { key: "system", label: "Sistema", value: counts.system, icon: AlertTriangle, accent: "text-red-300" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Central de Notificações</h1>
          <p className="text-sm text-white/50">
            {counts.unread} não lida{counts.unread === 1 ? "" : "s"} · atualização em tempo real
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!prefs.unlocked && (
            <button
              onClick={handleUnlock}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
            >
              Ativar sons de notificação
            </button>
          )}
          <button
            onClick={() => updatePrefs({ enabled: !prefs.enabled })}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
            title={prefs.enabled ? "Silenciar" : "Ativar sons"}
          >
            {prefs.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.08]"
          >
            <Settings2 className="mr-1 inline h-3.5 w-3.5" /> Configurações
          </button>
          <button
            onClick={() => markAll.mutate()}
            disabled={counts.unread === 0 || markAll.isPending}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.08] disabled:opacity-50"
          >
            Marcar todas como lidas
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Sons de notificação</div>
            {!prefs.unlocked && (
              <span className="text-xs text-amber-300">
                Áudio bloqueado pelo navegador — clique em "Ativar sons".
              </span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={prefs.enabled}
                onChange={(e) => updatePrefs({ enabled: e.target.checked })}
              />
              Sons ativados
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={prefs.criticalOnly}
                onChange={(e) => updatePrefs({ criticalOnly: e.target.checked })}
              />
              Apenas notificações críticas
            </label>
            <label className="flex items-center gap-3 text-sm">
              Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                onChange={(e) => updatePrefs({ volume: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-10 text-right text-xs text-white/50">
                {Math.round(prefs.volume * 100)}%
              </span>
            </label>
            <div className="flex items-center gap-2 text-sm">
              <span>Horário silencioso</span>
              <input
                type="time"
                value={prefs.quietStart ?? ""}
                onChange={(e) => updatePrefs({ quietStart: e.target.value || null })}
                className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
              />
              <span>até</span>
              <input
                type="time"
                value={prefs.quietEnd ?? ""}
                onChange={(e) => updatePrefs({ quietEnd: e.target.value || null })}
                className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs uppercase tracking-widest text-white/40">Por categoria</div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {(Object.keys(CATEGORY_META) as NotifCategory[]).map((k) => {
                const Meta = CATEGORY_META[k];
                return (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={prefs.perCategory[k]}
                        onChange={(e) =>
                          updatePrefs({
                            perCategory: { ...prefs.perCategory, [k]: e.target.checked },
                          })
                        }
                      />
                      <Meta.icon className="h-3.5 w-3.5 text-white/60" />
                      {Meta.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => testSound(k)}
                      disabled={!prefs.unlocked}
                      className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
                      title="Testar som"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary / quick filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {summaryCards.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`rounded-xl border p-3 text-left transition ${
                active
                  ? "border-cyan-400/40 bg-cyan-500/10"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-white/50">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.accent}`} />
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{c.value}</div>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, mensagem, tipo, ID…"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FilterStatus)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-white"
        >
          <option value="all">Todos os status</option>
          <option value="unread">Não lidas</option>
          <option value="read">Lidas</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as FilterPriority)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-white"
        >
          <option value="all">Todas prioridades</option>
          <option value="critical">Crítica</option>
          <option value="error">Erro</option>
          <option value="warning">Alerta</option>
          <option value="success">Sucesso</option>
          <option value="info">Info</option>
        </select>
        {(category !== "all" || status !== "all" || priority !== "all" || search) && (
          <button
            onClick={() => {
              setCategory("all");
              setStatus("all");
              setPriority("all");
              setSearch("");
            }}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08]"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/40">
          Nenhuma notificação encontrada.
          <div className="mt-1 text-xs">Novos eventos importantes aparecerão aqui.</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const sev = SEVERITY_META[n.severity];
            const Icon = sev.icon;
            const cat = categoryFromType(n.type);
            const CatMeta = CATEGORY_META[cat];
            const unreadRow = !n.read_at;
            const link =
              typeof n.payload === "object" && n.payload
                ? (n.payload as Record<string, unknown>).link
                : null;
            return (
              <li
                key={n.id}
                className={`flex items-start gap-3 rounded-xl border p-4 ${sev.cls} ${
                  unreadRow ? "ring-1 ring-cyan-400/30" : "opacity-70"
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{n.title}</span>
                      <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                        <CatMeta.icon className="mr-1 inline h-3 w-3" />
                        {CatMeta.label}
                      </span>
                      <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                        {sev.priorityLabel}
                      </span>
                    </div>
                    <div className="shrink-0 text-xs text-white/40">{formatDate(n.created_at)}</div>
                  </div>
                  {n.message && <div className="mt-1 text-sm text-white/70">{n.message}</div>}
                  <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-white/40">
                    <span>{n.type}</span>
                    {typeof link === "string" && (
                      <a
                        href={link}
                        className="text-cyan-300 hover:underline"
                      >
                        Abrir registro relacionado
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {unreadRow ? (
                    <button
                      onClick={() => markOne.mutate(n.id)}
                      className="rounded-md border border-white/10 p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                      title="Marcar como lida"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => unmarkOne.mutate(n.id)}
                      className="rounded-md border border-white/10 p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                      title="Marcar como não lida"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => removeOne.mutate(n.id)}
                    className="rounded-md border border-white/10 p-1.5 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                    title="Excluir notificação"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Marcador para satisfazer o TS quando `Wallet` for tree-shaken.
export const __iconRefs = [Wallet];
