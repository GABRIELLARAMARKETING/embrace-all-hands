import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  listAuditEvents,
  resolveAuditEvent,
  type AuditEventRow,
  type AuditSeverity,
} from "@/lib/audit.functions";
import { emitAuditTestEvents } from "@/lib/audit-test.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({ meta: [{ title: "Central de Auditoria — Admin" }] }),
  component: AuditoriaGeralPage,
});

const MODULES = [
  "all",
  "auth",
  "users",
  "admin_panel",
  "manager_panel",
  "affiliates",
  "referrals",
  "multilevel",
  "commissions",
  "deposits",
  "payments",
  "wallet",
  "withdrawals",
  "helix_game",
  "webhooks",
  "permissions",
  "frontend",
  "system",
] as const;

const SEVERITIES: Array<AuditSeverity | "all"> = [
  "all",
  "info",
  "success",
  "warning",
  "error",
  "critical",
];

function severityStyle(sev: AuditSeverity) {
  switch (sev) {
    case "critical":
      return { bg: "bg-red-600/20", text: "text-red-300", icon: AlertOctagon };
    case "error":
      return { bg: "bg-red-500/15", text: "text-red-300", icon: XCircle };
    case "warning":
      return { bg: "bg-amber-500/15", text: "text-amber-300", icon: AlertTriangle };
    case "success":
      return { bg: "bg-emerald-500/15", text: "text-emerald-300", icon: CheckCircle2 };
    default:
      return { bg: "bg-cyan-500/10", text: "text-cyan-200", icon: Info };
  }
}

function AuditoriaGeralPage() {
  const listFn = useServerFn(listAuditEvents);
  const resolveFn = useServerFn(resolveAuditEvent);
  const emitTestFn = useServerFn(emitAuditTestEvents);
  const qc = useQueryClient();
  const [emitting, setEmitting] = useState(false);

  async function onEmitTest() {
    setEmitting(true);
    try {
      const res = await emitTestFn({ data: {} });
      toast.success(`3 eventos de teste emitidos (${res.correlationId})`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEmitting(false);
    }
  }

  const [severity, setSeverity] = useState<AuditSeverity | "all">("all");
  const [module, setModule] = useState<(typeof MODULES)[number]>("all");
  const [search, setSearch] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [selected, setSelected] = useState<AuditEventRow | null>(null);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["audit-events", { severity, module, search, onlyErrors }],
    queryFn: () => listFn({ data: { severity, module, search, onlyErrors, limit: 300 } }),
  });

  // Realtime: recarrega quando novo evento chega
  useEffect(() => {
    const ch = supabase
      .channel("admin-audit-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_events" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["audit-events"] });
          const row = payload.new as { severity: string; title: string };
          if (row.severity === "critical" || row.severity === "error") {
            toast.error(`[${row.severity}] ${row.title}`);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const summary = data?.summary;
  const events = data?.events ?? [];

  const cards = [
    {
      label: "Status do Sistema",
      value:
        summary?.systemStatus === "ok"
          ? "OK"
          : summary?.systemStatus === "degraded"
            ? "Degradado"
            : "Crítico",
      icon: ShieldCheck,
      color:
        summary?.systemStatus === "ok"
          ? "text-emerald-300"
          : summary?.systemStatus === "degraded"
            ? "text-amber-300"
            : "text-red-300",
    },
    { label: "Eventos (24h)", value: summary?.total ?? 0, icon: Activity, color: "text-cyan-300" },
    { label: "Erros (24h)", value: summary?.errors ?? 0, icon: XCircle, color: "text-red-300" },
    {
      label: "Críticos (24h)",
      value: summary?.critical ?? 0,
      icon: AlertOctagon,
      color: "text-red-300",
    },
    {
      label: "Warnings (24h)",
      value: summary?.warnings ?? 0,
      icon: AlertTriangle,
      color: "text-amber-300",
    },
  ];

  async function onResolve(id: string) {
    try {
      await resolveFn({ data: { id } });
      toast.success("Evento marcado como resolvido");
      setSelected(null);
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Central de Auditoria Geral</h1>
          <p className="mt-1 text-sm text-white/60">
            Rastreio em tempo real de tudo que acontece no sistema — logins, depósitos, comissões,
            sessões Helix, webhooks, erros e alertas críticos.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Recarregar
        </button>
      </header>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-white/10 bg-[#0a0f1a] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-white/50">{c.label}</span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold ${c.color}`}>
              {isLoading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0f1a] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-white/50">Severidade</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AuditSeverity | "all")}
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-widest text-white/50">Módulo</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value as (typeof MODULES)[number])}
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1 min-w-[220px]">
            <label className="text-[10px] uppercase tracking-widest text-white/50">Busca</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="título, mensagem, event_type…"
              className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setOnlyErrors(e.target.checked)}
            />
            Só erros/warnings
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {(error as Error).message}
        </div>
      )}

      {/* Tabela */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f1a] p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-white/50">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Severidade</th>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-white/50">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-white/50">
                    Nenhum evento com os filtros atuais.
                  </td>
                </tr>
              )}
              {events.map((ev) => {
                const s = severityStyle(ev.severity);
                return (
                  <tr
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full ${s.bg} ${s.text} px-2 py-1 text-[11px] font-semibold`}
                      >
                        <s.icon className="h-3 w-3" />
                        {ev.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">{ev.module}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">{ev.event_type}</td>
                    <td className="px-4 py-3">{ev.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">
                      {ev.user_id ? ev.user_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {ev.resolved_at ? (
                        <span className="text-emerald-300">resolvido</span>
                      ) : (
                        ev.status ?? "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal detalhe */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a0f1a] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/50">
                  {selected.module} · {selected.event_type}
                </div>
                <h3 className="mt-1 text-lg font-bold">{selected.title}</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md border border-white/10 p-2 text-white/70 hover:bg-white/5"
              >
                ✕
              </button>
            </div>
            {selected.message && (
              <p className="mb-3 text-sm text-white/80">{selected.message}</p>
            )}
            {selected.technical_message && (
              <pre className="mb-3 max-h-40 overflow-auto rounded-md bg-black/60 p-3 text-xs text-red-200">
                {selected.technical_message}
              </pre>
            )}
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-white/50">Severidade:</span> {selected.severity}
              </div>
              <div>
                <span className="text-white/50">Quando:</span>{" "}
                {new Date(selected.created_at).toLocaleString("pt-BR")}
              </div>
              <div>
                <span className="text-white/50">Entidade:</span>{" "}
                {selected.entity_type ?? "—"} {selected.entity_id ? `#${selected.entity_id}` : ""}
              </div>
              <div>
                <span className="text-white/50">Correlation:</span>{" "}
                <span className="font-mono">{selected.correlation_id ?? "—"}</span>
              </div>
            </div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <pre className="max-h-52 overflow-auto rounded-md bg-black/60 p-3 text-xs text-white/70">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!selected.resolved_at && (
                <button
                  onClick={() => onResolve(selected.id)}
                  className="rounded-md bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-500/30"
                >
                  Marcar como resolvido
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
