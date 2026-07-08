import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { Badge } from "@/components/admin/Badge";
import { withdrawalSchema, type WithdrawalFormValues } from "@/utils/validators";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { sanitizeText } from "@/utils/sanitize";
import {
  getMyCommissionSummary,
  listMyWithdrawals,
  requestMyWithdrawal,
} from "@/lib/manager.functions";

export const Route = createFileRoute("/gerente/meus-saques")({
  head: () => ({
    meta: [
      { title: "Meus Saques · Gerente Helix" },
      { name: "description", content: "Solicite o saque das suas comissões acumuladas." },
    ],
  }),
  component: MeusSaquesPage,
});

function statusTone(s: string): "green" | "red" | "neutral" {
  if (s === "paid" || s === "approved") return "green";
  if (s === "rejected" || s === "canceled") return "red";
  return "neutral";
}
function statusLabel(s: string) {
  return { pending: "Pendente", approved: "Aprovado", paid: "Pago", rejected: "Recusado", canceled: "Cancelado" }[s] ?? s;
}

function MeusSaquesPage() {
  const qc = useQueryClient();
  const getSummary = useServerFn(getMyCommissionSummary);
  const getList = useServerFn(listMyWithdrawals);
  const request = useServerFn(requestMyWithdrawal);

  const summary = useQuery({ queryKey: ["gerente", "my-summary"], queryFn: () => getSummary() });
  const list = useQuery({ queryKey: ["gerente", "my-withdrawals"], queryFn: () => getList() });
  const available = summary.data?.availableBalance ?? 0;

  const mut = useMutation({
    mutationFn: (v: WithdrawalFormValues) =>
      request({ data: { amount: v.amount, pixKey: sanitizeText(v.pixKey, 120) } }),
    onSuccess: () => {
      toast.success("Solicitação enviada");
      qc.invalidateQueries({ queryKey: ["gerente", "my-summary"] });
      qc.invalidateQueries({ queryKey: ["gerente", "my-withdrawals"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao solicitar"),
  });

  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { pixKey: "", amount: undefined as unknown as number },
  });

  const onSubmit = (values: WithdrawalFormValues) => {
    if (available <= 0) {
      toast.error("Sem saldo disponível para saque");
      return;
    }
    if (values.amount > available) {
      form.setError("amount", { message: "Valor acima do saldo disponível" });
      return;
    }
    mut.mutate(values, {
      onSuccess: () => form.reset({ pixKey: "", amount: undefined as unknown as number }),
    });
  };

  return (
    <>
      <TopHeader title="Meus Saques" subtitle="Solicite o saque das suas comissões acumuladas" />
      <div className="space-y-6 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white">Meus Saques de Comissão</h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-text-3)]">
              Saldo disponível para saque
            </p>
            <p className="mt-3 text-4xl font-bold text-white">
              {summary.isLoading ? "…" : formatCurrency(available)}
            </p>
            <p className="mt-3 text-sm text-[color:var(--admin-text-2)]">
              Comissões acumuladas da sua rede
              {summary.data?.pendingBalance ? ` · pendente: ${formatCurrency(summary.data.pendingBalance)}` : null}
            </p>
          </AdminCard>

          <AdminCard>
            <h3 className="text-base font-semibold text-white">Solicitar Saque</h3>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <AdminInput
                label="Chave PIX"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                error={form.formState.errors.pixKey?.message}
                {...form.register("pixKey")}
              />
              <AdminInput
                label="Valor a receber (R$)"
                type="number"
                step="0.01"
                min={0}
                placeholder="0,00"
                error={form.formState.errors.amount?.message}
                {...form.register("amount", { valueAsNumber: true })}
              />
              <AdminButton type="submit" fullWidth loading={mut.isPending}>
                Solicitar Saque
              </AdminButton>
            </form>
          </AdminCard>
        </div>

        <AdminCard>
          <h3 className="mb-4 text-base font-semibold text-white">Histórico de Saques</h3>
          <AdminTable
            emptyState={<EmptyState message="Nenhum saque solicitado ainda" />}
            columns={[
              { key: "n", header: "#", render: (_r, i) => i + 1, width: "48px" },
              { key: "amount", header: "Valor", render: (r) => <span className="text-white">{formatCurrency(r.amount)}</span> },
              { key: "pix", header: "Chave PIX", render: (r) => r.pixKey },
              { key: "status", header: "Status", render: (r) => <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge> },
              { key: "date", header: "Data", render: (r) => formatDate(r.createdAt) },
            ]}
            rows={list.data ?? []}
            getRowKey={(r) => r.id}
          />
        </AdminCard>
      </div>
    </>
  );
}
