import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  getWithdrawalDetail,
  type AdminWithdrawalRow,
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
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchList = useServerFn(listAllWithdrawals);
  const approve = useServerFn(approveWithdrawal);
  const reject = useServerFn(rejectWithdrawal);
  const pay = useServerFn(markWithdrawalPaid);

  useAdminRealtime({
    table: "affiliate_withdrawals",
    invalidateKeys: [["admin", "withdrawals"], ["admin", "dashboard-summary"]],
    toastOnInsert: () => "Novo saque solicitado",
  });

  const { data = [], isFetching } = useQuery({
    ...withdrawalsQuery(filter),
    queryFn: () => fetchList({ data: filter ? { status: filter } : {} }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (w) =>
        (w.user_display_name ?? "").toLowerCase().includes(q) ||
        w.user_id.toLowerCase().includes(q) ||
        (w.pix_key ?? "").toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totals = useMemo(() => {
    let pending = 0, paid = 0;
    for (const w of data) {
      if (w.status === "pending" || w.status === "in_review" || w.status === "approved") pending += w.amount;
      if (w.status === "paid") paid += w.amount;
    }
    return { pending, paid };
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });

  const approveMut = useMutation({
    mutationFn: (input: { id: string; note?: string }) =>
      approve({ data: { withdrawalId: input.id, note: input.note } }),
    onSuccess: invalidate,
  });
  const rejectMut = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      reject({ data: { withdrawalId: input.id, reason: input.reason } }),
    onSuccess: invalidate,
  });
  const payMut = useMutation({
    mutationFn: (input: { id: string; note?: string }) =>
      pay({ data: { withdrawalId: input.id, note: input.note } }),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Saques</h1>
          <p className="text-sm text-white/50">
            {isFetching ? "Atualizando..." : `${filtered.length} de ${data.length} registros`}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
            <div className="text-[10px] uppercase text-amber-200/70">Em aberto</div>
            <div className="font-semibold text-amber-100 tabular-nums">{formatCurrency(totals.pending)}</div>
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
            <div className="text-[10px] uppercase text-emerald-200/70">Pagos</div>
            <div className="font-semibold text-emerald-100 tabular-nums">{formatCurrency(totals.paid)}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, id ou PIX..."
          className="ml-auto w-full max-w-xs rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
        />
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/40">
                  Nenhum saque.
                </td>
              </tr>
            )}
            {filtered.map((w) => (
              <tr key={w.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2 text-white/70">{formatDate(w.created_at)}</td>
                <td className="px-3 py-2">
                  <button
                    className="text-cyan-200 hover:underline"
                    onClick={() => setDetailId(w.id)}
                  >
                    {w.user_display_name ?? w.user_id.slice(0, 8)}
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(w.amount)}</td>
                <td className="px-3 py-2 text-white/60">{maskPix(w.pix_key)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={w.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setDetailId(w.id)}
                      className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/70 hover:bg-white/[0.08]"
                    >
                      Detalhes
                    </button>
                    {(w.status === "pending" || w.status === "in_review") && (
                      <>
                        <button
                          disabled={approveMut.isPending}
                          onClick={() => {
                            const note = window.prompt("Observação (opcional)") ?? undefined;
                            approveMut.mutate({ id: w.id, note: note?.trim() || undefined });
                          }}
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
                        onClick={() => {
                          const note = window.prompt("Comprovante/observação (opcional)") ?? undefined;
                          payMut.mutate({ id: w.id, note: note?.trim() || undefined });
                        }}
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

      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const fetchDetail = useServerFn(getWithdrawalDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "withdrawals", "detail", id],
    queryFn: () => fetchDetail({ data: { withdrawalId: id } }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Detalhes do saque</h2>
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/70 hover:bg-white/[0.08]"
          >
            Fechar
          </button>
        </div>

        {isLoading && <div className="mt-6 text-sm text-white/50">Carregando...</div>}
        {error && (
          <div className="mt-6 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {(error as Error).message}
          </div>
        )}
        {data && (
          <div className="mt-4 space-y-5 text-sm">
            <section className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 md:grid-cols-4">
              <Field label="Usuário" value={data.withdrawal.user_display_name ?? data.withdrawal.user_id.slice(0, 8)} />
              <Field label="Valor" value={formatCurrency(data.withdrawal.amount)} />
              <Field label="Status" value={<StatusBadge status={data.withdrawal.status} />} />
              <Field label="Solicitado" value={formatDate(data.withdrawal.created_at)} />
              <Field label="PIX" value={data.withdrawal.pix_key ?? "—"} />
              <Field label="Revisor" value={data.withdrawal.reviewer_name ?? "—"} />
              <Field label="Revisado em" value={data.withdrawal.reviewed_at ? formatDate(data.withdrawal.reviewed_at) : "—"} />
              <Field label="Pago em" value={data.withdrawal.paid_at ? formatDate(data.withdrawal.paid_at) : "—"} />
              <Field label="Saldo afiliado atual" value={formatCurrency(data.withdrawal.user_affiliate_balance)} />
              <Field label="Total recebido" value={formatCurrency(data.withdrawal.user_total_received)} />
              <Field label="IP" value={data.withdrawal.request_ip ?? "—"} />
              <Field label="Motivo recusa" value={data.withdrawal.rejection_reason ?? "—"} />
            </section>

            {data.withdrawal.admin_notes && (
              <section>
                <div className="mb-1 text-xs uppercase tracking-widest text-white/40">Observação admin</div>
                <div className="rounded-md border border-white/10 bg-white/[0.02] p-2 text-white/80">
                  {data.withdrawal.admin_notes}
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 text-xs uppercase tracking-widest text-white/40">Trilha de auditoria</div>
              <div className="space-y-1">
                {data.audit.length === 0 && (
                  <div className="text-white/40">Sem eventos.</div>
                )}
                {data.audit.map((a) => (
                  <div key={a.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-cyan-200">{a.action}</span>
                      <span className="text-white/40">{formatDate(a.created_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Por {a.actor_name ?? a.actor_id?.slice(0, 8) ?? "sistema"}
                      {a.reason ? ` — ${a.reason}` : ""}
                    </div>
                    {(a.old_value || a.new_value) && (
                      <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-white/50">
                        <code className="truncate rounded bg-black/40 px-1 py-0.5">antes: {a.old_value ?? "—"}</code>
                        <code className="truncate rounded bg-black/40 px-1 py-0.5">depois: {a.new_value ?? "—"}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-xs uppercase tracking-widest text-white/40">
                Histórico do usuário ({data.userHistory.length})
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-white/10">
                <table className="min-w-full text-xs">
                  <thead className="bg-white/5 text-white/50">
                    <tr>
                      <th className="px-2 py-1 text-left">Data</th>
                      <th className="px-2 py-1 text-right">Valor</th>
                      <th className="px-2 py-1 text-left">Status</th>
                      <th className="px-2 py-1 text-left">Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.userHistory.map((h: AdminWithdrawalRow) => (
                      <tr
                        key={h.id}
                        className={`border-t border-white/5 ${h.id === id ? "bg-cyan-500/5" : ""}`}
                      >
                        <td className="px-2 py-1 text-white/70">{formatDate(h.created_at)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(h.amount)}</td>
                        <td className="px-2 py-1"><StatusBadge status={h.status} /></td>
                        <td className="px-2 py-1 text-white/60">{h.paid_at ? formatDate(h.paid_at) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-0.5 text-white/85">{value}</div>
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
