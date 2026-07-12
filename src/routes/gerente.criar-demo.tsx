import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { MoneyValue } from "@/components/admin/MoneyValue";
import { demoAccountSchema, type DemoAccountFormValues } from "@/utils/validators";
import { formatDate } from "@/utils/formatDate";
import { createDemoAccounts, listDemoAccounts } from "@/lib/manager.functions";

function formatPhoneBR(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}


export const Route = createFileRoute("/gerente/criar-demo")({
  head: () => ({
    meta: [
      { title: "Criar Demo · Gerente Helix" },
      { name: "description", content: "Crie contas de demonstração vinculadas à sua rede." },
    ],
  }),
  component: CriarDemoPage,
});

type CreatedAccount = { id: string; name: string; phone: string; password: string; affiliateCode: string; balance: number };

function CriarDemoPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDemoAccounts);
  const createFn = useServerFn(createDemoAccounts);
  const { data: accounts } = useQuery({
    queryKey: ["gerente", "demo-accounts"],
    queryFn: () => listFn(),
  });
  const [justCreated, setJustCreated] = useState<CreatedAccount[]>([]);

  const form = useForm<DemoAccountFormValues>({
    resolver: zodResolver(demoAccountSchema),
    defaultValues: {
      namePattern: "demo",
      passwordPattern: "",
      quantity: undefined as unknown as number,
      initialBalance: undefined as unknown as number,
    },
  });

  const mut = useMutation({
    mutationFn: (values: DemoAccountFormValues) => createFn({ data: values }),
    onSuccess: (res) => {
      toast.success(`${res.created} conta(s) demo criada(s)`);
      setJustCreated(res.accounts as CreatedAccount[]);
      qc.invalidateQueries({ queryKey: ["gerente", "demo-accounts"] });
      form.reset({
        namePattern: form.getValues("namePattern"),
        passwordPattern: form.getValues("passwordPattern"),
        quantity: undefined as unknown as number,
        initialBalance: undefined as unknown as number,
      });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao criar"),
  });

  return (
    <>
      <TopHeader title="Criar Demo" subtitle="Crie contas de demonstração vinculadas à sua rede" />
      <div className="p-4 sm:p-5">
        <AdminCard className="mx-auto max-w-3xl">
          <h2 className="text-lg font-semibold text-white">Criar Conta Demo</h2>
          <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">
            Contas de demonstração são vinculadas à sua rede e não geram comissão real.
          </p>

          <form
            onSubmit={form.handleSubmit((v) => mut.mutate(v))}
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <AdminInput label="Padrão de Nome" placeholder="demo" hint="Ex: jose → Jose 1..." error={form.formState.errors.namePattern?.message} {...form.register("namePattern")} />
            <AdminInput label="Padrão de Senha" placeholder="Padrão de nome se vazio" hint="Ex: demo → demo@1..." error={form.formState.errors.passwordPattern?.message} {...form.register("passwordPattern")} />
            <AdminInput label="Quantidade" type="number" inputMode="numeric" min={1} max={100} placeholder="Ex: 10" error={form.formState.errors.quantity?.message} {...form.register("quantity", { valueAsNumber: true })} />
            <AdminInput label="Saldo Inicial (R$)" type="number" inputMode="decimal" step="0.01" min={0} placeholder="Ex: 1000.00" error={form.formState.errors.initialBalance?.message} {...form.register("initialBalance", { valueAsNumber: true })} />
            <div className="sm:col-span-2">
              <AdminButton type="submit" fullWidth leftIcon={<Plus size={18} />} loading={mut.isPending}>
                Criar Contas Demo
              </AdminButton>
            </div>
          </form>
        </AdminCard>

        {justCreated.length > 0 && (
          <AdminCard className="mx-auto mt-6 max-w-3xl border-[color:var(--admin-neon)]/30">
            <h3 className="text-base font-semibold text-white">Credenciais recém-criadas</h3>
            <p className="mt-1 text-xs text-[color:var(--admin-text-3)]">
              Use estas credenciais em <span className="font-mono">/login</span> (telefone + senha).
              As senhas aparecem apenas nesta tela e não podem ser recuperadas depois.
            </p>
            <AdminTable
              rows={justCreated}
              getRowKey={(r) => r.id}
              emptyState={<EmptyState message="—" />}
              columns={[
                { key: "name", header: "Nome", render: (r) => <span className="text-white">{r.name}</span> },
                { key: "phone", header: "Login (telefone)", render: (r) => <span className="font-mono text-xs">{formatPhoneBR(r.phone)}</span> },
                { key: "pw", header: "Senha", render: (r) => <span className="font-mono text-xs">{r.password}</span> },
                { key: "code", header: "Cód. afiliado", render: (r) => <span className="font-mono text-xs">{r.affiliateCode}</span> },
                { key: "bal", header: "Saldo", render: (r) => <MoneyValue value={r.balance} /> },
              ]}
            />
          </AdminCard>
        )}

        <AdminCard className="mx-auto mt-6 max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Contas criadas</h3>
            <span className="text-xs text-[color:var(--admin-text-3)]">{accounts?.length ?? 0} conta(s)</span>
          </div>
          <AdminTable
            emptyState={<EmptyState message="Nenhuma conta demo criada ainda" />}
            rows={accounts ?? []}
            getRowKey={(r) => r.id}
            columns={[
              { key: "n", header: "#", render: (_r, i) => i + 1, width: "48px" },
              { key: "name", header: "Nome", render: (r) => <span className="text-white">{r.name}</span> },
              { key: "phone", header: "Telefone", render: (r) => <span className="font-mono text-xs">{formatPhoneBR(r.phone)}</span> },
              { key: "code", header: "Cód.", render: (r) => <span className="font-mono text-xs">{r.affiliateCode}</span> },
              { key: "balance", header: "Saldo Inicial", render: (r) => <MoneyValue value={r.balance} /> },
              { key: "created", header: "Criada em", render: (r) => formatDate(r.createdAt) },
            ]}
          />
        </AdminCard>
      </div>
    </>
  );
}
