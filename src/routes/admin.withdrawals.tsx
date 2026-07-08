import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
} from "@/lib/withdrawals.functions";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

const withdrawalsQuery = (status?: string) =>
  queryOptions({
    queryKey: ["admin", "withdrawals", status ?? "all"],
    queryFn: () => listAllWithdrawals({ data: status ? { status } : {} }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Saques · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(withdrawalsQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

const STATUSES = [
  { key: "", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "in_review", label: "Em análise" },
  { key: "approved", label: "Aprovados" },
  { key: "paid", label: "Pagos" },
  { key: "rejected", label: "Recusados" },
] as const;

function Page() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("");
  const fetchList = useServerFn(listAllWithdrawals);
  const approve = useServerFn(approveWithdrawal);
  const reject = useServerFn(rejectWithdrawal);
  const pay = useServerFn(markWithdrawalPaid);

  const { data = [], isFetching } = useQuery({
    ...withdrawalsQuery(filter),
    queryFn: () => fetchList({ data: filter ? { status: filter } : {} }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { withdrawalId: id } }),
    onSuccess: invalidate,
  });
  const rejectMut = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      reject({ data: { withdrawalId: input.id, reason: input.reason } }),
    onSuccess: invalidate,
  });
  const payMut = useMutation({
    mutationFn: (id: string) => pay({ data: { withdrawalId: id } }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Saques</h1>
        <p className="text-sm text-white/50">
          {isFetching ? "Atualizando..." : `${data.length} registros`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-md border px-3 py-1 text-xs ${
              filter === s.key
                ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.06]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">Solicitado em</th>
              <th className="px-3 py-2 text-left">Usuário</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">PIX</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/40">
                  Nenhum saque.
                </td>
              </tr>
            )}
            {data.map((w) => (
              <tr key={w.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2 text-white/70">{formatDate(w.created_at)}</td>
                <td className="px-3 py-2">
                  {w.user_display_name ?? w.user_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(Number(w.amount))}
                </td>
                <td className="px-3 py-2 text-white/60">{maskPix(w.pix_key)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={w.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {(w.status === "pending" || w.status === "in_review") && (
                      <>
                        <button
                          disabled={approveMut.isPending}
                          onClick={() => approveMut.mutate(w.id)}
                          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                        <button
                          disabled={rejectMut.isPending}
                          onClick={() => {
                            const reason = window.prompt("Motivo da recusa (obrigatório)");
                            if (!reason || reason.trim().length < 3) return;
                            rejectMut.mutate({ id: w.id, reason: reason.trim() });
                          }}
                          className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                    {w.status === "approved" && (
                      <button
                        disabled={payMut.isPending}
                        onClick={() => payMut.mutate(w.id)}
                        className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
                      >
                        Marcar pago
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function maskPix(pix: string | null): string {
  if (!pix) return "—";
  if (pix.length <= 6) return "•".repeat(pix.length);
  return pix.slice(0, 3) + "•••" + pix.slice(-3);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    in_review: "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
    approved: "bg-violet-500/15 text-violet-200 border-violet-400/30",
    paid: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    rejected: "bg-red-500/15 text-red-200 border-red-400/30",
    cancelled: "bg-white/5 text-white/60 border-white/15",
    failed: "bg-red-500/15 text-red-200 border-red-400/30",
  };
  const label: Record<string, string> = {
    pending: "Pendente",
    in_review: "Em análise",
    approved: "Aprovado",
    paid: "Pago",
    rejected: "Recusado",
    cancelled: "Cancelado",
    failed: "Falhou",
  };
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs ${
        map[status] ?? "bg-white/5 text-white/60 border-white/15"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}
