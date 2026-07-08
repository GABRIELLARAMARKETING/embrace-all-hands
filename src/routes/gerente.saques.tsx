import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, DollarSign, RefreshCw } from "lucide-react";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminInput } from "@/components/admin/AdminInput";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import {
  listAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
  type AdminWithdrawalRow,
} from "@/lib/withdrawals.functions";

export const Route = createFileRoute("/gerente/saques")({
  head: () => ({
    meta: [
      { title: "Saques · Painel Gerente" },
      { name: "description", content: "Aprovar, recusar e pagar saques da plataforma." },
    ],
  }),
  component: SaquesAdminPage,
});

type StatusFilter = "all" | "pending" | "in_review" | "approved" | "paid" | "rejected" | "cancelled" | "failed";

const statusMeta: Record<string, { label: string; tone: "green" | "neutral" | "blue" | "purple" | "red" }> = {
  pending: { label: "Pendente", tone: "purple" },
  in_review: { label: "Em análise", tone: "blue" },
  approved: { label: "Aprovado", tone: "green" },
  paid: { label: "Pago", tone: "green" },
  rejected: { label: "Recusado", tone: "red" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  failed: { label: "Falhou", tone: "red" },
};

function SaquesAdminPage() {
  const qc = useQueryClient();
  const list = useServerFn(listAllWithdrawals);
  const approveFn = useServerFn(approveWithdrawal);
  const rejectFn = useServerFn(rejectWithdrawal);
  const payFn = useServerFn(markWithdrawalPaid);
  const [status, setStatus] = useState<StatusFilter>("all");

  const query = useQuery({
    queryKey: ["admin", "withdrawals", status],
    queryFn: () => list({ data: status === "all" ? {} : { status } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });

  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { withdrawalId: id } }),
    onSuccess: () => {
      toast.success("Saque aprovado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: (id: string) => payFn({ data: { withdrawalId: id } }),
    onSuccess: () => {
      toast.success("Marcado como pago.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      rejectFn({ data: { withdrawalId: vars.id, reason: vars.reason } }),
    onSuccess: () => {
      toast.success("Saque recusado e saldo devolvido.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows: AdminWithdrawalRow[] = query.data ?? [];

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, paid: 0 };
    for (const r of rows) {
      if (r.status === "pending" || r.status === "in_review") c.pending++;
      else if (r.status === "approved") c.approved++;
      else if (r.status === "paid") c.paid++;
    }
    return c;
  }, [rows]);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "paid", label: "Pagos" },
    { key: "rejected", label: "Recusados" },
  ];

  return (
    <>
      <TopHeader
        title="Saques"
        subtitle="Gestão administrativa de solicitações de saque"
        context={`${counts.pending} pendente(s) · ${counts.approved} aprovado(s) aguardando pagamento`}
      />
      <div className="space-y-4 p-4 sm:p-5">
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatus(f.key)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                    (status === f.key
                      ? "border-[color:var(--admin-green)]/40 bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]"
                      : "border-[color:var(--admin-border)] bg-transparent text-[color:var(--admin-text-2)] hover:bg-white/[0.03]")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <AdminButton
              variant="ghost"
              onClick={() => invalidate()}
              disabled={query.isFetching}
            >
              <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
              Atualizar
            </AdminButton>
          </div>
        </AdminCard>

        <AdminCard padding="sm">
          <AdminTable
            rows={rows}
            getRowKey={(r) => r.id}
            emptyState={
              <EmptyState
                title="Nenhum saque"
                description="Nenhuma solicitação encontrada para este filtro."
              />
            }
            columns={[
              {
                key: "user",
                header: "Usuário",
                render: (r) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {r.user_display_name ?? "—"}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[color:var(--admin-text-3)]">
                      {r.user_id.slice(0, 8)}
                    </p>
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Valor",
                render: (r) => (
                  <span className="font-semibold text-white">
                    {formatCurrency(r.amount / 100)}
                  </span>
                ),
              },
              {
                key: "pix",
                header: "PIX",
                render: (r) => (
                  <span className="font-mono text-xs text-[color:var(--admin-text-2)]">
                    {r.pix_key ? maskPix(r.pix_key) : "—"}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => {
                  const m = statusMeta[r.status] ?? { label: r.status, tone: "neutral" as const };
                  return <Badge tone={m.tone}>{m.label}</Badge>;
                },
              },
              {
                key: "created",
                header: "Solicitado em",
                render: (r) => (
                  <span className="text-xs text-[color:var(--admin-text-2)]">
                    {formatDate(r.created_at)}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Ações",
                render: (r) => (
                  <div className="flex flex-wrap gap-1.5">
                    {(r.status === "pending" || r.status === "in_review") && (
                      <>
                        <AdminButton
                          size="sm"
                          onClick={() => {
                            if (confirm(`Aprovar saque de ${formatCurrency(r.amount / 100)}?`))
                              approve.mutate(r.id);
                          }}
                          loading={approve.isPending && approve.variables === r.id}
                        >
                          <Check size={12} />
                          Aprovar
                        </AdminButton>
                        <AdminButton
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            const reason = prompt("Motivo da recusa (mínimo 3 caracteres):");
                            if (reason && reason.trim().length >= 3)
                              reject.mutate({ id: r.id, reason: reason.trim() });
                          }}
                        >
                          <X size={12} />
                          Recusar
                        </AdminButton>
                      </>
                    )}
                    {r.status === "approved" && (
                      <AdminButton
                        size="sm"
                        onClick={() => {
                          if (confirm("Confirma que o pagamento foi realizado?"))
                            pay.mutate(r.id);
                        }}
                        loading={pay.isPending && pay.variables === r.id}
                      >
                        <DollarSign size={12} />
                        Marcar pago
                      </AdminButton>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </AdminCard>

        {query.isError && (
          <AdminCard className="border-[color:var(--admin-red)]/40 bg-[color:var(--admin-red)]/8">
            <p className="text-sm text-[color:var(--admin-red)]">
              Erro ao carregar saques: {(query.error as Error).message}
            </p>
          </AdminCard>
        )}
      </div>
    </>
  );
}

function maskPix(key: string) {
  if (key.length <= 6) return "***";
  return key.slice(0, 3) + "•••" + key.slice(-3);
}
// keep AdminInput import used (no lint warn)
export const _keepInput = AdminInput;
