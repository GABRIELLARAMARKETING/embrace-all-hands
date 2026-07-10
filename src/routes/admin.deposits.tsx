import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  listDiggionDeposits,
  reconcileDepositById,
  reconcilePendingDeposits,
} from "@/lib/deposits.functions";
import {
  getPaymentDivergences,
  generateDivergenceAlerts,
} from "@/lib/admin-block1.functions";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const depositsQuery = (status: string, search: string) =>
  queryOptions({
    queryKey: ["admin", "diggion-deposits", status, search],
    queryFn: () => listDiggionDeposits({ data: { status, search: search || undefined } }),
    staleTime: 10_000,
  });

export const Route = createFileRoute("/admin/deposits")({
  head: () => ({ meta: [{ title: "Depósitos Diggion · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(depositsQuery("all", "")),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

const STATUSES = [
  { v: "all", label: "Todos" },
  { v: "pending", label: "Pendentes" },
  { v: "waiting_payment", label: "Aguardando" },
  { v: "paid", label: "Pagos" },
  { v: "approved", label: "Aprovados" },
  { v: "expired", label: "Expirados" },
  { v: "canceled", label: "Cancelados" },
  { v: "failed", label: "Falhos" },
];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    waiting_payment: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    expired: "bg-white/5 text-white/50 border-white/10",
    canceled: "bg-white/5 text-white/50 border-white/10",
    failed: "bg-red-500/15 text-red-300 border-red-400/30",
    rejected: "bg-red-500/15 text-red-300 border-red-400/30",
  };
  return map[s] ?? "bg-white/5 text-white/60 border-white/10";
}

function Page() {
  const [tab, setTab] = useState<"list" | "divergences">("list");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const fetchDivs = useServerFn(getPaymentDivergences);
  const genAlerts = useServerFn(generateDivergenceAlerts);
  const { data: divs = [], refetch: refetchDivs, isFetching: divFetching } = useQuery({
    queryKey: ["admin", "payment-divergences"],
    queryFn: () => fetchDivs(),
    staleTime: 30_000,
    enabled: tab === "divergences",
  });
  const alertsMut = useMutation({
    mutationFn: () => genAlerts(),
    onSuccess: (r) => setMsg(`${r.created} alerta(s) criados a partir das divergências`),
    onError: (e: any) => setMsg(`Erro: ${e?.message ?? e}`),
  });

  const qc = useQueryClient();
  const { data, isFetching, refetch } = useQuery(depositsQuery(status, search));
  const rows = data?.rows ?? [];

  const reconcileOne = useServerFn(reconcileDepositById);
  const reconcileAll = useServerFn(reconcilePendingDeposits);

  const oneMut = useMutation({
    mutationFn: (depositId: string) => reconcileOne({ data: { depositId } }),
    onSuccess: (r) => {
      setMsg(`Resultado: ${r.result}${r.provider_status ? ` (${r.provider_status})` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin", "diggion-deposits"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-summary"] });
    },
    onError: (e: any) => setMsg(`Erro: ${e?.message ?? e}`),
  });

  const allMut = useMutation({
    mutationFn: () => reconcileAll(),
    onSuccess: (r: any) => {
      setMsg(`${r.checked} depósito(s) verificados`);
      qc.invalidateQueries({ queryKey: ["admin", "diggion-deposits"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-summary"] });
    },
    onError: (e: any) => setMsg(`Erro: ${e?.message ?? e}`),
  });

  useAdminRealtime({
    table: "deposits",
    invalidateKeys: [["admin", "diggion-deposits"]],
  });

  const totalPaid = rows.filter((r) => r.status === "paid" || r.status === "approved")
    .reduce((s, r) => s + r.amount, 0);
  const totalPending = rows.filter((r) => r.status === "pending" || r.status === "waiting_payment")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Depósitos Diggion</h1>
          <p className="text-sm text-white/50">Validação, reconciliação e auditoria de pagamentos PIX.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {tab === "list" && (
            <button
              onClick={() => allMut.mutate()}
              disabled={allMut.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${allMut.isPending ? "animate-spin" : ""}`} />
              Reconciliar pendentes
            </button>
          )}
          {tab === "divergences" && divs.length > 0 && (
            <button
              onClick={() => alertsMut.mutate()}
              disabled={alertsMut.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Gerar alertas
            </button>
          )}
          <button
            onClick={() => (tab === "list" ? refetch() : refetchDivs())}
            disabled={isFetching || divFetching}
            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(isFetching || divFetching) ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        <TabBtn active={tab === "list"} onClick={() => setTab("list")}>Depósitos</TabBtn>
        <TabBtn active={tab === "divergences"} onClick={() => setTab("divergences")}>
          Divergências{divs.length ? ` (${divs.length})` : ""}
        </TabBtn>
      </div>

      {tab === "divergences" && (
        <DivergencesPanel rows={divs} loading={divFetching} />
      )}

      {tab === "list" && (
      <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Pagos (visível)" value={formatCurrency(totalPaid)} icon={CheckCircle2} tone="emerald" />
        <Kpi label="Pendentes (visível)" value={formatCurrency(totalPending)} icon={Clock} tone="amber" />
        <Kpi label="Total (linhas)" value={String(rows.length)} icon={XCircle} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.v}
            onClick={() => setStatus(s.v)}
            className={`rounded-full border px-3 py-1 text-xs ${
              status === s.v
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ID ou external_id…"
          className="ml-auto rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40"
        />
      </div>

      {msg && (
        <div className="rounded-md border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          {msg}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Criado</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Diggion TX</th>
              <th className="px-4 py-3">Pago em</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/40">
                  Nenhum depósito encontrado.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.user_name ?? r.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                    {r.last_error && (
                      <div className="mt-1 text-[10px] text-red-300/70">{r.last_error}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-white/50">
                    {r.external_id ? r.external_id.slice(0, 20) + (r.external_id.length > 20 ? "…" : "") : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/60">{r.paid_at ? formatDate(r.paid_at) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => oneMut.mutate(r.id)}
                      disabled={oneMut.isPending || !r.external_id}
                      className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                    >
                      Validar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "slate";
}) {
  const t: Record<string, string> = {
    emerald: "border-emerald-400/20 text-emerald-300",
    amber: "border-amber-400/20 text-amber-300",
    slate: "border-white/10 text-white/70",
  };
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-4 ${t[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
