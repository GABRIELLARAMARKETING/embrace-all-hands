import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  UserCog,
  Wallet,
  ShieldAlert,
  CircleDollarSign,
  Lock,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { getAdminDashboardSummary } from "@/lib/admin.functions";
import { formatCurrency } from "@/utils/formatCurrency";

const summaryQuery = () =>
  queryOptions({
    queryKey: ["admin", "dashboard-summary"],
    queryFn: () => getAdminDashboardSummary(),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Admin Helix" },
      { name: "description", content: "Visão geral operacional da plataforma Helix." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(summaryQuery()),
  component: AdminDashboard,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      Falha ao carregar métricas: {error.message}
    </div>
  ),
});

const TONE: Record<string, string> = {
  cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-400/20",
  violet: "from-violet-500/20 to-violet-500/5 text-violet-300 border-violet-400/20",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-400/20",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-400/20",
  red: "from-red-500/20 to-red-500/5 text-red-300 border-red-400/20",
  slate: "from-slate-500/20 to-slate-500/5 text-slate-300 border-slate-400/20",
};

function AdminDashboard() {
  const router = useRouter();
  const fetchSummary = useServerFn(getAdminDashboardSummary);
  const { data, isFetching, refetch } = useQuery({
    ...summaryQuery(),
    queryFn: () => fetchSummary(),
  });

  const cards = [
    { label: "Total de usuários", value: data?.totalUsers ?? 0, icon: Users, tone: "cyan" },
    { label: "Gerentes ativos", value: data?.activeManagers ?? 0, icon: UserCog, tone: "violet" },
    { label: "Afiliados ativos", value: data?.activeAffiliates ?? 0, icon: Users, tone: "emerald" },
    { label: "Saques pendentes", value: data?.pendingWithdrawals ?? 0, icon: Wallet, tone: "amber" },
    {
      label: "Pago no mês",
      value: formatCurrency(data?.paidWithdrawalsMonth ?? 0),
      icon: CircleDollarSign,
      tone: "emerald",
    },
    { label: "Alertas abertos", value: data?.openRiskAlerts ?? 0, icon: ShieldAlert, tone: "red" },
    { label: "Contas bloqueadas", value: data?.blockedAccounts ?? 0, icon: Lock, tone: "slate" },
    {
      label: "Comissões pendentes",
      value: formatCurrency(data?.totalCommissionsPending ?? 0),
      icon: TrendingUp,
      tone: "violet",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-white/50">Visão geral da operação em tempo real.</p>
        </div>
        <button
          onClick={() => {
            refetch();
            router.invalidate();
          }}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`rounded-xl border bg-gradient-to-br p-4 ${TONE[tone]}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/60">{label}</span>
              <Icon className="h-4 w-4 opacity-80" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
