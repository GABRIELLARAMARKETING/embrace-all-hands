import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import {
  listCommissions,
  listCommissionAudit,
  settleCommission,
  updateCommissionStatus,
  type CommissionRow,
  type CommissionStatus,
  type CommissionAuditRow,
} from "@/lib/admin-extras.functions";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { toast } from "sonner";

type Filter = CommissionStatus | "";

const commissionsQuery = (status?: CommissionStatus) =>
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

const STATUSES: Array<{ v: Filter; label: string }> = [
  { v: "", label: "Todas" },
  { v: "pending", label: "Pendentes" },
  { v: "available", label: "Disponíveis" },
  { v: "approved", label: "Aprovadas" },
  { v: "paid", label: "Pagas" },
  { v: "reversed", label: "Estornadas" },
  { v: "canceled", label: "Canceladas" },
  { v: "disputed", label: "Disputadas" },
];

function Page() {
  const [status, setStatus] = useState<Filter>("");
  const { data: rows = [] } = useQuery(commissionsQuery(status || undefined));
  const qc = useQueryClient();
  const updateFn = useServerFn(updateCommissionStatus);
  const settleFn = useServerFn(settleCommission);

  const [modal, setModal] = useState<{ row: CommissionRow; action: "pay" | "reverse" } | null>(null);
  const [historyRow, setHistoryRow] = useState<CommissionRow | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "commissions"] });
    qc.invalidateQueries({ queryKey: ["admin", "dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    qc.invalidateQueries({ queryKey: ["admin", "commission-audit"] });
  };

  const update = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settle = useMutation({
    mutationFn: settleFn,
    onSuccess: (res) => {
      toast.success(res.status === "paid" ? "Comissão marcada como paga" : "Comissão estornada");
      setModal(null);
      invalidate();
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
              <th className="px-4 py-3">Liquidação</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-white/40">Nenhuma comissão encontrada.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.affiliate_name ?? r.affiliate_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white/70">{r.manager_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-white/70">{formatCurrency(r.base_amount)}</td>
                  <td className="px-4 py-3 text-right text-white/60">{(r.percentage * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-white/60">
                    {r.paid_at && (
                      <div>
                        <div className="text-emerald-300">Pago {formatDate(r.paid_at)}</div>
                        {r.paid_amount != null && r.paid_amount !== r.amount && (
                          <div className="font-mono">{formatCurrency(r.paid_amount)}</div>
                        )}
                      </div>
                    )}
                    {r.reversed_at && (
                      <div className="text-red-300">Estornado {formatDate(r.reversed_at)}</div>
                    )}
                    {r.notes && <div className="mt-1 text-white/50 line-clamp-2">{r.notes}</div>}
                    {!r.paid_at && !r.reversed_at && !r.notes && "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <button
                        onClick={() => setHistoryRow(r)}
                        className="rounded-md border border-white/15 bg-white/[0.03] px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Histórico
                      </button>
                      {r.status !== "paid" && (
                        <button
                          onClick={() => setModal({ row: r, action: "pay" })}
                          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Marcar paga
                        </button>
                      )}
                      {r.status !== "reversed" && (
                        <button
                          onClick={() => setModal({ row: r, action: "reverse" })}
                          className="rounded-md border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-200 hover:bg-orange-500/20"
                        >
                          Estornar
                        </button>
                      )}
                      {r.status !== "approved" && r.status !== "paid" && r.status !== "reversed" && (
                        <button
                          disabled={update.isPending}
                          onClick={() => update.mutate({ data: { commissionId: r.id, status: "approved" } })}
                          className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20"
                        >
                          Aprovar
                        </button>
                      )}
                      {r.status !== "canceled" && r.status !== "paid" && (
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

      {modal && (
        <SettleModal
          row={modal.row}
          action={modal.action}
          pending={settle.isPending}
          onClose={() => setModal(null)}
          onConfirm={(payload) =>
            settle.mutate({
              data: {
                commissionId: modal.row.id,
                action: modal.action,
                amount: payload.amount,
                notes: payload.notes || undefined,
                occurredAt: payload.occurredAt,
              },
            })
      {historyRow && (
        <HistoryModal row={historyRow} onClose={() => setHistoryRow(null)} />
      )}
    </div>
  );
}

function HistoryModal({ row, onClose }: { row: CommissionRow; onClose: () => void }) {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin", "commission-audit", row.id],
    queryFn: () => listCommissionAudit({ data: { commissionId: row.id } }),
    staleTime: 10_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Histórico da comissão</h3>
            <p className="mt-1 text-xs text-white/50">
              Afiliado: <span className="text-white/80">{row.affiliate_name ?? row.affiliate_id.slice(0, 8)}</span>{" "}
              · Valor: <span className="font-mono text-white/80">{formatCurrency(row.amount)}</span>
            </p>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:text-white">
            Fechar
          </button>
        </div>

        {isLoading && <div className="py-6 text-center text-sm text-white/50">Carregando…</div>}
        {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{(error as Error).message}</div>}
        {!isLoading && !error && rows.length === 0 && (
          <div className="py-6 text-center text-sm text-white/40">Nenhum evento de auditoria para esta comissão.</div>
        )}

        <ol className="space-y-3">
          {rows.map((ev) => (
            <li key={ev.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-mono ${actionTone(ev.action)}`}>
                  {ev.action}
                </span>
                <span className="text-xs text-white/50">{formatDate(ev.created_at)}</span>
              </div>
              <div className="mt-2 text-xs text-white/60">
                Por: <span className="text-white/80">{ev.actor_name ?? ev.actor_email ?? ev.actor_id?.slice(0, 8) ?? "sistema"}</span>
                {ev.ip && <span className="ml-2 text-white/40">IP {ev.ip}</span>}
              </div>
              {ev.reason && <div className="mt-1 text-xs text-white/60">Motivo: {ev.reason}</div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ValueBlock title="Antes" value={ev.old_value} tone="red" />
                <ValueBlock title="Depois" value={ev.new_value} tone="emerald" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ValueBlock({ title, value, tone }: { title: string; value: unknown; tone: "red" | "emerald" }) {
  const border = tone === "red" ? "border-red-400/20" : "border-emerald-400/20";
  const label = tone === "red" ? "text-red-200/80" : "text-emerald-200/80";
  return (
    <div className={`rounded-md border ${border} bg-black/30 p-2`}>
      <div className={`mb-1 text-[10px] uppercase tracking-wide ${label}`}>{title}</div>
      {value == null ? (
        <div className="text-xs text-white/40">—</div>
      ) : (
        <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-white/80">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

function actionTone(action: string) {
  if (action === "commission.paid") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  if (action === "commission.reversed") return "border-orange-400/40 bg-orange-500/15 text-orange-100";
  if (action.startsWith("commission.status.")) return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
  return "border-white/10 bg-white/5 text-white/70";
}
        />
      )}
    </div>
  );
}

function SettleModal({
  row,
  action,
  pending,
  onClose,
  onConfirm,
}: {
  row: CommissionRow;
  action: "pay" | "reverse";
  pending: boolean;
  onClose: () => void;
  onConfirm: (p: { amount?: number; notes: string; occurredAt: string }) => void;
}) {
  const isPay = action === "pay";
  const [amount, setAmount] = useState<string>(row.amount.toFixed(2));
  const [notes, setNotes] = useState<string>("");
  const [when, setWhen] = useState<string>(() => new Date().toISOString().slice(0, 16));

  const submit = () => {
    const iso = new Date(when).toISOString();
    const amt = isPay ? Number(amount.replace(",", ".")) : undefined;
    if (isPay && (!amt || !Number.isFinite(amt) || amt <= 0)) {
      toast.error("Informe um valor válido");
      return;
    }
    onConfirm({ amount: amt, notes: notes.trim(), occurredAt: iso });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold">
            {isPay ? "Marcar comissão como paga" : "Estornar comissão"}
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Afiliado: <span className="text-white/80">{row.affiliate_name ?? row.affiliate_id.slice(0, 8)}</span>{" "}
            · Valor original: <span className="font-mono text-white/80">{formatCurrency(row.amount)}</span>
          </p>
        </div>

        <div className="space-y-3">
          {isPay && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-white/60">Valor pago (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-white"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/60">
              {isPay ? "Data do pagamento" : "Data do estorno"}
            </span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/60">Observação</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isPay ? "ID da transferência, PIX, etc." : "Motivo do estorno"}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 hover:text-white"
          >
            Cancelar
          </button>
          <button
            disabled={pending}
            onClick={submit}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              isPay
                ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                : "border border-orange-400/40 bg-orange-500/20 text-orange-100 hover:bg-orange-500/30"
            } disabled:opacity-50`}
          >
            {pending ? "Salvando..." : isPay ? "Confirmar pagamento" : "Confirmar estorno"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    available: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    approved: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    paid: "border-emerald-400/50 bg-emerald-500/20 text-emerald-100",
    reversed: "border-orange-400/40 bg-orange-500/15 text-orange-200",
    canceled: "border-red-400/30 bg-red-500/10 text-red-200",
    disputed: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tones[status] ?? "border-white/10 text-white/60"}`}>{status}</span>;
}
