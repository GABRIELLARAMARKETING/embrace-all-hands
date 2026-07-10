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
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { getAdminDashboardSummary } from "@/lib/admin.functions";
import {
  getAdminDashboardExtras,
  getDepositsTimeSeries,
  getRecentActivity,
} from "@/lib/admin-block1.functions";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const summaryQuery = () =>
  queryOptions({
    queryKey: ["admin", "dashboard-summary"],
    queryFn: () => getAdminDashboardSummary(),
    staleTime: 30_000,
  });
const extrasQuery = () =>
  queryOptions({
    queryKey: ["admin", "dashboard-extras"],
    queryFn: () => getAdminDashboardExtras(),
    staleTime: 30_000,
  });
const seriesQuery = () =>
  queryOptions({
    queryKey: ["admin", "dashboard-series"],
    queryFn: () => getDepositsTimeSeries({ data: { days: 14 } }),
    staleTime: 60_000,
  });
const activityQuery = () =>
  queryOptions({
    queryKey: ["admin", "dashboard-activity"],
    queryFn: () => getRecentActivity(),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Admin Helix" },
      { name: "description", content: "Visão geral operacional da plataforma Helix." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(summaryQuery());
    context.queryClient.prefetchQuery(extrasQuery());
    context.queryClient.prefetchQuery(seriesQuery());
    context.queryClient.prefetchQuery(activityQuery());
  },
  component: AdminDashboard,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      Falha ao carregar métricas: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-white/60">Página não encontrada.</div>,
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
  const fetchExtras = useServerFn(getAdminDashboardExtras);
  const fetchSeries = useServerFn(getDepositsTimeSeries);
  const fetchActivity = useServerFn(getRecentActivity);

  const { data, isFetching, refetch } = useQuery({ ...summaryQuery(), queryFn: () => fetchSummary() });
  const { data: extras, refetch: refetchExtras } = useQuery({ ...extrasQuery(), queryFn: () => fetchExtras() });
  const { data: series } = useQuery({ ...seriesQuery(), queryFn: () => fetchSeries({ data: { days: 14 } }) });
  const { data: activity } = useQuery({ ...activityQuery(), queryFn: () => fetchActivity() });

  useAdminRealtime({
    table: "deposits",
    invalidateKeys: [
      ["admin", "dashboard-summary"],
      ["admin", "dashboard-extras"],
      ["admin", "dashboard-series"],
      ["admin", "dashboard-activity"],
    ],
    toastOnInsert: (row) =>
      row.status === "paid" ? `Nova venda: R$ ${Number(row.amount).toFixed(2)}` : null,
  });
  useAdminRealtime({
    table: "wallet_transactions",
    invalidateKeys: [["admin", "dashboard-extras"]],
  });

  const cards = [
    { label: "Total de usuários", value: data?.totalUsers ?? 0, icon: Users, tone: "cyan" },
    { label: "Gerentes ativos", value: data?.activeManagers ?? 0, icon: UserCog, tone: "violet" },
    { label: "Afiliados ativos", value: data?.activeAffiliates ?? 0, icon: Users, tone: "emerald" },
    { label: "Contas bloqueadas", value: data?.blockedAccounts ?? 0, icon: Lock, tone: "slate" },

    { label: "Depósitos recebidos", value: formatCurrency(extras?.totalDepositsPaid ?? 0), icon: ArrowDownCircle, tone: "emerald" },
    { label: "Depósitos hoje", value: formatCurrency(extras?.depositsToday ?? 0), icon: CircleDollarSign, tone: "cyan" },
    { label: "Saques pagos", value: formatCurrency(extras?.totalWithdrawalsPaid ?? 0), icon: ArrowUpCircle, tone: "violet" },
    { label: "Comissões pagas", value: formatCurrency(extras?.totalCommissionsPaid ?? 0), icon: TrendingUp, tone: "emerald" },

    { label: "Saques pendentes", value: data?.pendingWithdrawals ?? 0, icon: Wallet, tone: "amber" },
    { label: "Pago no mês", value: formatCurrency(data?.paidWithdrawalsMonth ?? 0), icon: CircleDollarSign, tone: "emerald" },
    { label: "Comissões pendentes", value: formatCurrency(data?.totalCommissionsPending ?? 0), icon: TrendingUp, tone: "violet" },
    { label: "Receita líquida", value: formatCurrency(extras?.netRevenue ?? 0), icon: TrendingUp, tone: (extras?.netRevenue ?? 0) >= 0 ? "emerald" : "red" as any },

    { label: "Webhooks OK", value: extras?.webhooksProcessed ?? 0, icon: CheckCircle2, tone: "emerald" },
    { label: "Webhooks c/ erro", value: extras?.webhooksErrors ?? 0, icon: XCircle, tone: "red" },
    { label: "Alertas abertos", value: data?.openRiskAlerts ?? 0, icon: ShieldAlert, tone: "red" },
    { label: "Divergências", value: extras?.divergencesCount ?? 0, icon: AlertTriangle, tone: (extras?.divergencesCount ?? 0) > 0 ? "red" : "slate" },
  ] as const;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-white/50">Visão geral da operação em tempo real.</p>
        </div>
        <button
          onClick={() => {
            refetch();
            refetchExtras();
            router.invalidate();
          }}
          disabled={isFetching}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
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
            transition={{ delay: i * 0.02 }}
            className={`rounded-xl border bg-gradient-to-br p-4 ${TONE[tone as string] ?? TONE.slate}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs uppercase tracking-wider text-white/60">{label}</span>
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
            </div>
            <div className="mt-3 truncate text-2xl font-semibold text-white">{value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Depósitos — últimos 14 dias</h2>
            <span className="text-xs text-white/40">R$ por dia</span>
          </div>
          <DepositsChart data={series ?? []} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-semibold text-white">Atividade recente</h2>
          </div>
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {(activity ?? []).length === 0 ? (
              <div className="text-xs text-white/40">Sem atividades recentes.</div>
            ) : (
              (activity ?? []).map((a) => <ActivityItem key={a.id} row={a} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DepositsChart({ data }: { data: Array<{ day: string; deposits: number; count: number }> }) {
  if (!data.length) return <div className="text-xs text-white/40">Sem dados.</div>;
  const max = Math.max(1, ...data.map((d) => d.deposits));
  return (
    <div className="flex h-[220px] items-end gap-1.5">
      {data.map((d) => {
        const h = Math.max(2, (d.deposits / max) * 190);
        return (
          <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
            <div className="relative w-full">
              <div
                className="w-full rounded-t bg-gradient-to-t from-cyan-500/40 to-cyan-400/80 transition-all hover:from-emerald-500/60 hover:to-emerald-400"
                style={{ height: `${h}px` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-black/90 px-2 py-1 text-[10px] text-white group-hover:block">
                {d.day}: {d.deposits.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {d.count}
              </div>
            </div>
            <span className="text-[9px] text-white/40">{d.day.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActivityItem({ row }: { row: { id: string; kind: string; title: string; amount: number | null; user_name: string | null; status: string | null; created_at: string } }) {
  const tone =
    row.kind === "deposit" ? "border-emerald-400/20 bg-emerald-500/5" :
    row.kind === "withdrawal" ? "border-violet-400/20 bg-violet-500/5" :
    row.kind === "alert" ? "border-red-400/20 bg-red-500/5" :
    "border-amber-400/20 bg-amber-500/5";
  return (
    <div className={`rounded-md border p-2 text-xs ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-white/90">{row.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-white/50">
            {row.user_name && <span>{row.user_name}</span>}
            <span>{formatDate(row.created_at)}</span>
            {row.status && <span className="uppercase">{row.status}</span>}
          </div>
        </div>
        {row.amount != null && (
          <span className="shrink-0 font-mono text-emerald-300">{formatCurrency(row.amount)}</span>
        )}
      </div>
    </div>
  );
}
