import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { AppLayout } from "@/components/player/AppLayout";
import { getPlayableDepositDebug } from "@/lib/helix-play-debug.functions";
import { formatCurrency } from "@/utils/formatCurrency";

export const Route = createFileRoute("/app/jogar/debug")({
  head: () => ({
    meta: [{ title: "Diagnóstico — Depósito Jogável" }],
  }),
  component: DebugPage,
});

function DebugPage() {
  const fetchDebug = useServerFn(getPlayableDepositDebug);
  const q = useQuery({
    queryKey: ["helix", "playable-deposit", "debug"],
    queryFn: () => fetchDebug(),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (q.data) {
      // Log estruturado no console do navegador para copiar/colar.
      // eslint-disable-next-line no-console
      console.log("[HELIX PLAY DEBUG]", q.data);
    }
  }, [q.data]);

  return (
    <AppLayout>
      <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-[#0a0f1a] p-5 text-sm text-white">
        <header>
          <h1 className="text-lg font-bold">Diagnóstico — /app/jogar</h1>
          <p className="mt-1 text-xs text-white/60">
            Mostra qual depósito o backend considera jogável. Reflete exatamente
            a regra usada por <code>getPlayableDeposit</code>.
          </p>
        </header>

        {q.isLoading && <p>Carregando...</p>}
        {q.error && (
          <p className="text-red-400">
            Erro: {q.error instanceof Error ? q.error.message : String(q.error)}
          </p>
        )}

        {q.data && (
          <>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-xs uppercase tracking-wider text-emerald-300/80">
                Resultado
              </div>
              <div className="mt-1 font-mono text-xs">
                reason: <b>{q.data.reason}</b>
              </div>
              {q.data.chosen ? (
                <div className="mt-1 font-mono text-xs">
                  chosen: id=<b>{q.data.chosen.id}</b> · amount=
                  <b>{formatCurrency(q.data.chosen.amount)}</b> · status=
                  <b>{q.data.chosen.status}</b>
                </div>
              ) : (
                <div className="mt-1 font-mono text-xs text-amber-300">
                  Nenhum depósito jogável encontrado.
                </div>
              )}
              <div className="mt-1 font-mono text-[11px] text-white/50">
                allowedAmounts: [{q.data.allowedAmounts.join(", ")}]
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="px-2 py-2">ID</th>
                    <th className="px-2 py-2">amount</th>
                    <th className="px-2 py-2">status</th>
                    <th className="px-2 py-2">provider</th>
                    <th className="px-2 py-2">credited_at</th>
                    <th className="px-2 py-2">paid_at</th>
                    <th className="px-2 py-2">allowed</th>
                    <th className="px-2 py-2">used?</th>
                    <th className="px-2 py-2">playable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {q.data.deposits.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-2 py-4 text-center text-white/40">
                        Nenhum depósito.
                      </td>
                    </tr>
                  )}
                  {q.data.deposits.map((d) => (
                    <tr key={d.id} className={d.isPlayable ? "bg-emerald-500/10" : ""}>
                      <td className="px-2 py-1">{d.id.slice(0, 8)}…</td>
                      <td className="px-2 py-1">{formatCurrency(d.amount)}</td>
                      <td className="px-2 py-1">{d.status}</td>
                      <td className="px-2 py-1">{d.provider}</td>
                      <td className="px-2 py-1">{d.credited_at ?? "—"}</td>
                      <td className="px-2 py-1">{d.paid_at ?? "—"}</td>
                      <td className="px-2 py-1">{d.isAllowedAmount ? "✓" : "✗"}</td>
                      <td className="px-2 py-1">
                        {d.usedBy ? `sess ${d.usedBy.session_id.slice(0, 6)}…` : "—"}
                      </td>
                      <td className="px-2 py-1">{d.isPlayable ? "✅" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] text-white/70">
{JSON.stringify(q.data, null, 2)}
            </pre>
          </>
        )}
      </div>
    </AppLayout>
  );
}
