import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { TopHeader } from "@/components/admin/TopHeader";
import { StatCard } from "@/components/admin/StatCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { getManagerDashboardSummary } from "@/lib/manager.functions";
import { formatCurrency } from "@/utils/formatCurrency";

export const Route = createFileRoute("/gerente/painel")({
  head: () => ({
    meta: [
      { title: "Painel · Gerente Helix" },
      { name: "description", content: "Resumo financeiro e pendências da sua rede." },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const fn = useServerFn(getManagerDashboardSummary);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["gerente", "dashboard"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

  const cards = [
    { label: "Depósitos pendentes", value: isLoading ? "…" : (data?.pendingDeposits ?? 0), description: "da sua rede" },
    { label: "Saques pendentes", value: isLoading ? "…" : (data?.pendingWithdrawals ?? 0), description: "da sua rede" },
    { label: "Total indicados", value: isLoading ? "…" : (data?.totalReferrals ?? 0), description: "nível 1 + 2 + 3" },
    { label: "Recebido (24h)", value: isLoading ? "…" : formatCurrency(data?.received24h ?? 0), description: "da sua rede" },
    { label: "Sacado (24h)", value: isLoading ? "…" : formatCurrency(data?.withdrawn24h ?? 0), description: "da sua rede" },
    { label: "Total recebido", value: isLoading ? "…" : formatCurrency(data?.totalReceived ?? 0), description: "da sua rede" },
  ];

  return (
    <>
      <TopHeader
        title="Painel"
        subtitle="Resumo financeiro e pendências"
        context="Métricas apenas da sua rede de indicados (nível 1, 2 e 3)"
      />
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex justify-end">
          <AdminButton
            variant="secondary"
            leftIcon={<RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />}
            onClick={() => refetch()}
          >
            Atualizar
          </AdminButton>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cards.map((c) => (
            <StatCard key={c.label} {...c} />
          ))}
        </motion.div>
      </div>
    </>
  );
}
