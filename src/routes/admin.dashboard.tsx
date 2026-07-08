import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Users,
  UserCog,
  Wallet,
  ShieldAlert,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Admin Helix" },
      { name: "description", content: "Visão geral operacional da plataforma Helix." },
    ],
  }),
  component: AdminDashboard,
});

const METRICS = [
  { label: "Total de usuários", value: "—", icon: Users, tone: "cyan" },
  { label: "Gerentes ativos", value: "—", icon: UserCog, tone: "violet" },
  { label: "Afiliados ativos", value: "—", icon: Users, tone: "emerald" },
  { label: "Saques pendentes", value: "—", icon: Wallet, tone: "amber" },
  { label: "Receita (mês)", value: "R$ —", icon: CircleDollarSign, tone: "emerald" },
  { label: "Alertas de risco", value: "—", icon: ShieldAlert, tone: "red" },
] as const;

const TONE: Record<string, string> = {
  cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-400/20",
  violet: "from-violet-500/20 to-violet-500/5 text-violet-300 border-violet-400/20",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-400/20",
  amber: "from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-400/20",
  red: "from-red-500/20 to-red-500/5 text-red-300 border-red-400/20",
};

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-white/50">
          Visão geral da operação. Os cards serão populados com dados reais nas próximas etapas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map(({ label, value, icon: Icon, tone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
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

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <TrendingUp className="h-4 w-4 text-cyan-300" />
          Gráficos e rankings serão adicionados nas próximas fases.
        </div>
      </div>
    </div>
  );
}
