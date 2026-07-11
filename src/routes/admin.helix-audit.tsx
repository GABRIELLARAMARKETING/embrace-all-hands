import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RefreshCw, ShieldAlert, Gamepad2, AlertTriangle, Activity } from "lucide-react";
import { auditHelixPayoutRules } from "@/lib/helix-audit.functions";
import { HELIX_DEPOSIT_RULES } from "@/lib/helix-rules";
import { formatCurrency } from "@/utils/formatCurrency";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/helix-audit")({
  head: () => ({ meta: [{ title: "Auditoria Helix — Admin" }] }),
  component: HelixAuditPage,
});

const AUTO_REFRESH_MS = 15_000;

function HelixAuditPage() {
  const auditFn = useServerFn(auditHelixPayoutRules);
  const { data, isLoading, isFetching, refetch, error, dataUpdatedAt } = useQuery({
    queryKey: ["helix-audit"],
    queryFn: () => auditFn({}),
    refetchInterval: AUTO_REFRESH_MS,
    refetchIntervalInBackground: true,
  });

  // Realtime: reexecuta auditoria quando depósitos/sessões mudam
  useEffect(() => {
    const channel = supabase
      .channel("helix-audit-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Alertas: toast quando novas divergências aparecem
  const prevCountsRef = useRef<{ rules: number; deps: number; sess: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    const rulesFail = data.rules.filter((r) => !r.ok).length;
    const deps = data.invalidDeposits.length;
    const sess = data.sessionMismatches.length;
    const prev = prevCountsRef.current;
    if (prev) {
      if (deps > prev.deps) toast.error(`Novo depósito inválido detectado (${deps - prev.deps})`);
      if (sess > prev.sess) toast.error(`Nova sessão com payout divergente (${sess - prev.sess})`);
      if (rulesFail > prev.rules) toast.error(`Regra oficial de payout divergente no banco!`);
    }
    prevCountsRef.current = { rules: rulesFail, deps, sess };
  }, [data]);

  const totalIssues = data
    ? data.invalidDeposits.length +
      data.sessionMismatches.length +
      data.rules.filter((r) => !r.ok).length
    : 0;
  const healthy = data && totalIssues === 0;

  return (
    <div className="space-y-6 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auditoria Helix — Payout por Plataforma</h1>
          <p className="mt-1 text-sm text-white/60">
            Valida as regras oficiais de depósito PIX e verifica se sessões e depósitos
            estão dentro dos valores permitidos.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Reexecutar auditoria
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {(error as Error).message}
        </div>
      )}

      {/* Regras oficiais */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f1a] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg font-semibold">Regras oficiais (valor → payout por plataforma)</h2>
          {data && (
            <span
              className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
                data.rulesAllOk
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {data.rulesAllOk ? "TODAS OK" : "DIVERGÊNCIA"}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-white/50">
              <tr>
                <th className="py-2 pr-4">Depósito</th>
                <th className="py-2 pr-4">Payout esperado</th>
                <th className="py-2 pr-4">Retorno do banco</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rules ?? HELIX_DEPOSIT_RULES.map((r) => ({
                amount: r.amount,
                expectedPayoutCents: r.payoutCents,
                actualPayoutCents: null,
                ok: false,
              }))).map((r) => (
                <tr key={r.amount} className="border-t border-white/5">
                  <td className="py-2 pr-4 font-semibold">{formatCurrency(r.amount)}</td>
                  <td className="py-2 pr-4 text-emerald-300">
                    {formatCurrency(r.expectedPayoutCents / 100)}
                  </td>
                  <td className="py-2 pr-4 text-white/80">
                    {r.actualPayoutCents == null
                      ? isLoading
                        ? "…"
                        : "—"
                      : formatCurrency(r.actualPayoutCents / 100)}
                  </td>
                  <td className="py-2">
                    {r.ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> OK
                      </span>
                    ) : data ? (
                      <span className="inline-flex items-center gap-1 text-red-300">
                        <XCircle className="h-4 w-4" /> Divergente
                      </span>
                    ) : (
                      <span className="text-white/40">…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Depósitos com valor inválido */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f1a] p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-300" />
          <h2 className="text-lg font-semibold">Depósitos com valor fora dos permitidos</h2>
          {data && (
            <span
              className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
                data.invalidDeposits.length === 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {data.invalidDeposits.length} encontrado(s)
            </span>
          )}
        </div>
        {data && data.invalidDeposits.length === 0 ? (
          <p className="text-sm text-white/60">
            Nenhum depósito fora dos valores permitidos nas últimas 200 transações.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-white/50">
                <tr>
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Usuário</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {data?.invalidDeposits.map((d) => (
                  <tr key={d.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 font-mono text-xs">{d.id.slice(0, 8)}…</td>
                    <td className="py-2 pr-4 font-mono text-xs">{d.user_id.slice(0, 8)}…</td>
                    <td className="py-2 pr-4 font-semibold text-red-300">
                      {formatCurrency(d.amount)}
                    </td>
                    <td className="py-2 pr-4 text-white/70">{d.status}</td>
                    <td className="py-2 text-white/60">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sessões com payout divergente */}
      <section className="rounded-2xl border border-white/10 bg-[#0a0f1a] p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-300" />
          <h2 className="text-lg font-semibold">Sessões com payout divergente</h2>
          {data && (
            <span
              className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${
                data.sessionMismatches.length === 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {data.sessionMismatches.length} encontrada(s)
            </span>
          )}
        </div>
        {data && data.sessionMismatches.length === 0 ? (
          <p className="text-sm text-white/60">
            Todas as sessões pagas recentes têm payout coerente com o depósito.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-white/50">
                <tr>
                  <th className="py-2 pr-4">Sessão</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2 pr-4">Payout atual</th>
                  <th className="py-2 pr-4">Esperado</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.sessionMismatches.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 font-mono text-xs">{s.id.slice(0, 8)}…</td>
                    <td className="py-2 pr-4">
                      {s.deposit_amount != null ? formatCurrency(s.deposit_amount) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-red-300">
                      {formatCurrency(s.payout_per_platform_cents / 100)}
                    </td>
                    <td className="py-2 pr-4 text-emerald-300">
                      {s.expected_payout_cents != null
                        ? formatCurrency(s.expected_payout_cents / 100)
                        : "—"}
                    </td>
                    <td className="py-2 text-white/70">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data && (
        <p className="text-xs text-white/40">
          Última verificação: {new Date(data.checkedAt).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
