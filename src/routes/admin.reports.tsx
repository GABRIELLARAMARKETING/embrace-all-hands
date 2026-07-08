import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { listReportExports, requestReportExport } from "@/lib/admin-extras.functions";
import { formatDate } from "@/utils/formatDate";
import { toast } from "sonner";

const reportsQuery = () =>
  queryOptions({
    queryKey: ["admin", "report-exports"],
    queryFn: () => listReportExports(),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Relatórios · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(reportsQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
  ),
});

const TYPES = ["withdrawals", "commissions", "transactions", "affiliates", "managers"] as const;

function Page() {
  const { data: rows = [] } = useQuery(reportsQuery());
  const qc = useQueryClient();
  const reqFn = useServerFn(requestReportExport);
  const req = useMutation({
    mutationFn: reqFn,
    onSuccess: () => {
      toast.success("Exportação solicitada");
      qc.invalidateQueries({ queryKey: ["admin", "report-exports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-white/50">Solicite exportações operacionais.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TYPES.map((t) => (
          <button
            key={t}
            disabled={req.isPending}
            onClick={() => req.mutate({ data: { type: t } })}
            className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-cyan-400/40 hover:bg-cyan-400/5"
          >
            <div className="text-sm font-semibold capitalize">{t}</div>
            <div className="mt-1 text-xs text-white/50">Gerar exportação</div>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Arquivo</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-white/40">Nenhuma exportação ainda.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 capitalize">{r.type}</td>
                  <td className="px-4 py-3 text-white/70">{r.status}</td>
                  <td className="px-4 py-3">
                    {r.file_url ? (
                      <a href={r.file_url} className="text-cyan-300 hover:underline" target="_blank" rel="noreferrer">baixar</a>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
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
