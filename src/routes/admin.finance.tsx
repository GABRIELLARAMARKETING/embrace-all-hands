import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listTransactions } from "@/lib/admin-extras.functions";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";


const txQuery = (type?: string) =>
  queryOptions({
    queryKey: ["admin", "transactions", type ?? "all"],
    queryFn: () => listTransactions({ data: type ? { type } : {} }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/finance")({
  head: () => ({ meta: [{ title: "Financeiro · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(txQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

const TYPES = ["", "deposit_paid", "withdrawal_requested", "withdrawal_paid", "withdrawal_rejected", "commission_created", "commission_approved", "manual_adjustment_positive", "manual_adjustment_negative"];

function Page() {
  const [type, setType] = useState<string>("");
  const { data } = useQuery(txQuery(type || undefined));
  const rows = data?.rows ?? [];
  const s = data?.summary ?? { totalIn: 0, totalOut: 0, netFlow: 0, txCount: 0 };

  const invalidateAll = [["admin", "transactions"], ["admin", "dashboard-summary"]] as const;
  useAdminRealtime({
    table: "deposits",
    invalidateKeys: invalidateAll as unknown as Array<readonly unknown[]>,
    toastOnInsert: (row) =>
      row.status === "paid" ? `Nova venda confirmada: R$ ${Number(row.amount).toFixed(2)}` : null,
  });
  useAdminRealtime({
    table: "wallet_transactions",
    invalidateKeys: invalidateAll as unknown as Array<readonly unknown[]>,
    toastOnInsert: (row) =>
      row.type === "deposit" ? `Depósito creditado: R$ ${Number(row.amount).toFixed(2)}` : null,
  });
  useAdminRealtime({
    table: "transactions",
    invalidateKeys: invalidateAll as unknown as Array<readonly unknown[]>,
  });


  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-white/50">Fluxo de transações da plataforma.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Entradas" value={formatCurrency(s.totalIn)} tone="emerald" />
        <Kpi label="Saídas" value={formatCurrency(s.totalOut)} tone="red" />
        <Kpi label="Saldo líquido" value={formatCurrency(s.netFlow)} tone="cyan" />
        <Kpi label="Transações" value={String(s.txCount)} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t || "all"}
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1 text-xs ${
              type === t ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-white/60 hover:text-white"
            }`}
          >
            {t || "Todos"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Saldo após</th>
              <th className="px-4 py-3">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                  Nenhuma transação encontrada.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/60">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">{r.user_name ?? r.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white/70">{r.type}</td>
                  <td className={`px-4 py-3 text-right font-mono ${r.amount >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white/60">
                    {r.balance_after != null ? formatCurrency(r.balance_after) : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/50">{r.description ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "emerald" | "red" | "cyan" | "slate" }) {
  const t: Record<string, string> = {
    emerald: "border-emerald-400/20 text-emerald-300",
    red: "border-red-400/20 text-red-300",
    cyan: "border-cyan-400/20 text-cyan-300",
    slate: "border-white/10 text-white/70",
  };
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-4 ${t[tone]}`}>
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
