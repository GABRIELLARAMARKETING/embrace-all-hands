import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listRiskAlerts, updateRiskAlertStatus } from "@/lib/admin-extras.functions";
import { formatDate } from "@/utils/formatDate";
import { toast } from "sonner";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

type Status = "open" | "reviewing" | "resolved" | "ignored";

const alertsQuery = (status?: Status) =>
  queryOptions({
    queryKey: ["admin", "risk-alerts", status ?? "all"],
    queryFn: () => listRiskAlerts({ data: status ? { status } : {} }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/risk-alerts")({
  head: () => ({ meta: [{ title: "Alertas de Risco · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(alertsQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
  ),
});

const OPTS: Array<{ v: Status | ""; label: string }> = [
  { v: "", label: "Todos" },
  { v: "open", label: "Abertos" },
  { v: "reviewing", label: "Em análise" },
  { v: "resolved", label: "Resolvidos" },
  { v: "ignored", label: "Ignorados" },
];

function Page() {
  const [status, setStatus] = useState<Status | "">("open");
  const { data: rows = [] } = useQuery(alertsQuery(status || undefined));
  const qc = useQueryClient();
  const updFn = useServerFn(updateRiskAlertStatus);
  const upd = useMutation({
    mutationFn: updFn,
    onSuccess: () => {
      toast.success("Alerta atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "risk-alerts"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useAdminRealtime({
    table: "risk_alerts",
    invalidateKeys: [["admin", "risk-alerts"], ["admin", "dashboard-summary"]],
    toastOnInsert: (row) => `Novo alerta: ${(row.title as string) ?? "risco detectado"}`,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Alertas de Risco</h1>
        <p className="text-sm text-white/50">Monitoramento antifraude e conformidade.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {OPTS.map((o) => (
          <button
            key={o.v}
            onClick={() => setStatus(o.v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === o.v ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/40">
            Nenhum alerta encontrado.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={r.severity} />
                    <span className="text-xs uppercase tracking-wider text-white/50">{r.type}</span>
                  </div>
                  <div className="mt-1 font-semibold">{r.title}</div>
                  {r.description && <div className="mt-1 text-sm text-white/60">{r.description}</div>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/40">
                    <span>Usuário: {r.user_name ?? r.user_id?.slice(0, 8) ?? "—"}</span>
                    <span>{formatDate(r.created_at)}</span>
                    <span>Status: {r.status}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {r.status !== "reviewing" && (
                    <button
                      onClick={() => upd.mutate({ data: { alertId: r.id, status: "reviewing" } })}
                      className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200"
                    >
                      Analisar
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button
                      onClick={() => upd.mutate({ data: { alertId: r.id, status: "resolved" } })}
                      className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                    >
                      Resolver
                    </button>
                  )}
                  {r.status !== "ignored" && (
                    <button
                      onClick={() => upd.mutate({ data: { alertId: r.id, status: "ignored" } })}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60"
                    >
                      Ignorar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const t: Record<string, string> = {
    low: "border-white/10 text-white/60",
    medium: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    high: "border-orange-400/30 bg-orange-500/10 text-orange-200",
    critical: "border-red-400/30 bg-red-500/10 text-red-200",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${t[severity] ?? t.low}`}>{severity}</span>;
}
