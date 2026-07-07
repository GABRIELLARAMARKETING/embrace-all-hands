import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { MoneyValue } from "@/components/admin/MoneyValue";
import { demoAccountSchema, type DemoAccountFormValues } from "@/utils/validators";
import { demoAccountsService } from "@/services/demoAccountsService";
import { useAdminStore } from "@/store/useAdminStore";
import { formatDate } from "@/utils/formatDate";


export const Route = createFileRoute("/admin/criar-demo")({
  head: () => ({
    meta: [
      { title: "Criar Demo · Gerente Helix" },
      { name: "description", content: "Crie contas de demonstração vinculadas à sua rede." },
    ],
  }),
  component: CriarDemoPage,
});

function CriarDemoPage() {
  const accounts = useAdminStore((s) => s.demoAccounts);

  const form = useForm<DemoAccountFormValues>({

    resolver: zodResolver(demoAccountSchema),
    defaultValues: {
      namePattern: "demo",
      passwordPattern: "",
      quantity: undefined as unknown as number,
      initialBalance: undefined as unknown as number,
    },
  });

  const onSubmit = async (values: DemoAccountFormValues) => {
    try {
      const list = await demoAccountsService.create(values);
      toast.success(`${list.length} conta(s) demo criada(s)`);
      form.reset({
        namePattern: values.namePattern,
        passwordPattern: values.passwordPattern,
        quantity: undefined as unknown as number,
        initialBalance: undefined as unknown as number,
      });
    } catch {
      toast.error("Não foi possível criar as contas");
    }
  };

  return (
    <>
      <TopHeader
        title="Criar Demo"
        subtitle="Crie contas de demonstração vinculadas à sua rede"
      />
      <div className="p-4 sm:p-8">
        <AdminCard className="mx-auto max-w-3xl">
          <h2 className="text-lg font-semibold text-white">Criar Conta Demo</h2>
          <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">
            Crie contas de demonstração vinculadas à sua rede. As contas são criadas no modo{" "}
            <span className="font-semibold text-[color:var(--admin-neon)]">Super Fácil</span> com
            login via telefone.
          </p>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <AdminInput
              label="Padrão de Nome"
              placeholder="demo"
              hint="Ex: jose → Jose 1, Jose 2..."
              error={form.formState.errors.namePattern?.message}
              {...form.register("namePattern")}
            />
            <AdminInput
              label="Padrão de Senha"
              placeholder="Padrão de nome se vazio"
              hint="Ex: demo → demo@1, demo@2..."
              error={form.formState.errors.passwordPattern?.message}
              {...form.register("passwordPattern")}
            />
            <AdminInput
              label="Quantidade"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              placeholder="Ex: 10"
              error={form.formState.errors.quantity?.message}
              {...form.register("quantity", { valueAsNumber: true })}
            />
            <AdminInput
              label="Saldo Inicial (R$)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder="Ex: 1000.00"
              error={form.formState.errors.initialBalance?.message}
              {...form.register("initialBalance", { valueAsNumber: true })}
            />

            <div className="sm:col-span-2">
              <AdminButton
                type="submit"
                fullWidth
                leftIcon={<Plus size={18} />}
                loading={form.formState.isSubmitting}
              >
                Criar Contas Demo
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </div>
    </>
  );
}
