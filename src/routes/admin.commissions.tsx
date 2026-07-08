import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listCommissions, updateCommissionStatus } from "@/lib/admin-extras.functions";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { toast } from "sonner";

type Status = "pending" | "available" | "approved" | "canceled" | "disputed";

const commissionsQuery = (status?: Status) =>
  queryOptions({
    queryKey: ["admin", "commissions", status ?? "all"],
    queryFn: () => listCommissions({ data: status ? { status } : {} }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/commissions")({
  head: () => ({ meta: [{ title: "Comissões · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(commissionsQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
  ),
});

const STATUSES: Array<{ v: Status | ""; label: string }> = [
  { v: "", label: "Todas" },
  { v: "pending", label: "Pendentes" },
  { v: "available", label: "Disponíveis" },
  { v: "approved", label: "Aprovadas" },
  { v: "canceled", label: "Canceladas" },
  { v: "disputed", label: "Disputadas" },
];

function Page() {
  const [status, setStatus] = useState<Status | "">("");
  const { data: rows = [] } = useQuery(commissionsQuery(status || undefined));
  const qc = useQueryClient();
  const updateFn = useServerFn(updateCommissionStatus);
  const update = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin", "commissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Comissões</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.v}
            onClick={() => setStatus(s.v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === s.v ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Afiliado</th>
              <th className="px-4 py-3">Gerente</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-white/40">Nenhuma comissão encontrada.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.affiliate_name ?? r.affiliate_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white/70">{r.manager_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-white/70">{formatCurrency(r.base_amount)}</td>
                  <td className="px-4 py-3 text-right text-white/60">{(r.percentage * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {r.status !== "approved" && (
                        <button
                          disabled={update.isPending}
                          onClick={() => update.mutate({ data: { commissionId: r.id, status: "approved" } })}
                          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Aprovar
                        </button>
                      )}
                      {r.status !== "canceled" && (
                        <button
                          disabled={update.isPending}
                          onClick={() => update.mutate({ data: { commissionId: r.id, status: "canceled" } })}
                          className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    available: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    approved: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    canceled: "border-red-400/30 bg-red-500/10 text-red-200",
    disputed: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tones[status] ?? "border-white/10 text-white/60"}`}>{status}</span>;
}
