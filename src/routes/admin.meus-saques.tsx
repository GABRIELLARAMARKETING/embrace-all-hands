import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { Badge } from "@/components/admin/Badge";
import { useAdminStore } from "@/store/useAdminStore";
import { withdrawalSchema, type WithdrawalFormValues } from "@/utils/validators";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { sanitizeText } from "@/utils/sanitize";

export const Route = createFileRoute("/admin/meus-saques")({
  head: () => ({
    meta: [
      { title: "Meus Saques · Gerente Helix" },
      { name: "description", content: "Solicite o saque das suas comissões acumuladas." },
    ],
  }),
  component: MeusSaquesPage,
});

function MeusSaquesPage() {
  const available = useAdminStore((s) => s.availableBalance);
  const withdrawals = useAdminStore((s) => s.withdrawals);
  const addWithdrawal = useAdminStore((s) => s.addWithdrawal);

  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      pixKey: "",
      amount: undefined as unknown as number,
    },
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
    addWithdrawal({
      amount: values.amount,
      pixKey: sanitizeText(values.pixKey, 120),
    });
    toast.success("Solicitação enviada");
    form.reset({ pixKey: "", amount: undefined as unknown as number });
  };

  return (
    <>
      <TopHeader
        title="Meus Saques"
        subtitle="Solicite o saque das suas comissões acumuladas"
      />
      <div className="space-y-6 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-white">Meus Saques de Comissão</h2>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AdminCard>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-text-3)]">
              Saldo disponível para saque
            </p>
            <p className="mt-3 text-4xl font-bold text-white">{formatCurrency(available)}</p>
            <p className="mt-3 text-sm text-[color:var(--admin-text-2)]">
              Comissões acumuladas da sua rede
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
              <AdminButton type="submit" fullWidth loading={form.formState.isSubmitting}>
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
              {
                key: "amount",
                header: "Valor",
                render: (r) => (
                  <span className="text-white">{formatCurrency(r.amount)}</span>
                ),
              },
              { key: "pix", header: "Chave PIX", render: (r) => r.pixKey },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge
                    tone={
                      r.status === "Aprovado"
                        ? "green"
                        : r.status === "Recusado"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {r.status}
                  </Badge>
                ),
              },
              { key: "date", header: "Data", render: (r) => formatDate(r.createdAt) },
            ]}
            rows={withdrawals}
            getRowKey={(r) => r.id}
          />
        </AdminCard>
      </div>
    </>
  );
}
