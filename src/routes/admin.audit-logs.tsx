import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listAuditLogs } from "@/lib/admin-extras.functions";
import { formatDate } from "@/utils/formatDate";

const logsQuery = (search?: string) =>
  queryOptions({
    queryKey: ["admin", "audit-logs", search ?? ""],
    queryFn: () => listAuditLogs({ data: search ? { search } : {} }),
    staleTime: 10_000,
  });

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({ meta: [{ title: "Logs · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(logsQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
  ),
});

function Page() {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<string>("");
  const { data: rows = [] } = useQuery(logsQuery(applied || undefined));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Logs de Auditoria</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por ação (ex: withdrawal.approve)"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-cyan-400/50"
        />
        <button className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
          Buscar
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Ator</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">Nenhum log encontrado.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.actor_name ?? r.actor_email ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-200">{r.action}</td>
                  <td className="px-4 py-3 text-white/60">{r.entity_type}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}</td>
                  <td className="px-4 py-3 text-white/50">{r.ip ?? "—"}</td>
                  <td className="px-4 py-3 text-white/50">{r.reason ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
