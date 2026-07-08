import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { TopHeader } from "@/components/admin/TopHeader";
import { StatCard } from "@/components/admin/StatCard";
import { useAdminStore } from "@/store/useAdminStore";
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
  const metrics = useAdminStore((s) => s.metrics);

  const cards = [
    { label: "Depósitos pendentes", value: metrics.pendingDeposits, description: "da sua rede" },
    { label: "Saques pendentes", value: metrics.pendingWithdrawals, description: "da sua rede" },
    { label: "Total indicados", value: metrics.totalReferrals, description: "nível 1 + 2 + 3" },
    { label: "Recebido (24h)", value: formatCurrency(metrics.received24h), description: "da sua rede" },
    { label: "Sacado (24h)", value: formatCurrency(metrics.withdrawn24h), description: "da sua rede" },
    { label: "Total recebido", value: formatCurrency(metrics.totalReceived), description: "da sua rede" },
  ];

  return (
    <>
      <TopHeader
        title="Painel"
        subtitle="Resumo financeiro e pendências"
        context="Métricas apenas da sua rede de indicados (nível 1, 2 e 3)"
      />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3"
      >
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </motion.div>
    </>
  );
}
