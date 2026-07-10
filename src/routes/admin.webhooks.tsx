import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminWebhooks, type AdminWebhookRow } from "@/lib/admin-webhooks.functions";
import { reprocessWebhookById } from "@/lib/admin-block1.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/webhooks")({
  ssr: false,
  component: AdminWebhooksPage,
});

const STATUS_TABS = [
  { key: "all", label: "Todos" },
  { key: "processed", label: "Processados" },
  { key: "pending", label: "Pendentes" },
  { key: "error", label: "Com erro" },
  { key: "invalid_signature", label: "Assinatura inválida" },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["key"];

function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v: string) {
  return new Date(v).toLocaleString("pt-BR");
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const cls =
    s === "paid" || s === "approved" || s === "completed" || s === "credited"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
      : s === "failed" || s === "canceled" || s === "expired" || s === "refunded" || s === "chargeback" || s === "refused"
        ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
        : "bg-amber-500/10 text-amber-300 border-amber-500/20";
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${cls}`}>
      {status ?? "—"}
    </span>
  );
}

function AdminWebhooksPage() {
  const fetchWebhooks = useServerFn(listAdminWebhooks);
  const [status, setStatus] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminWebhookRow | null>(null);
  const pageSize = 25;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-webhooks", status, search, page],
    queryFn: () => fetchWebhooks({ data: { status, search: search || undefined, page, pageSize } }),
    staleTime: 10_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const summary = useMemo(() => {
    const ok = rows.filter((r) => r.processed && !r.processing_error).length;
    const err = rows.filter((r) => !!r.processing_error).length;
    const pending = rows.filter((r) => !r.processed).length;
    return { ok, err, pending };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Auditoria de Webhooks</h1>
        <p className="text-sm text-white/60">
          Cada webhook recebido, com payment_status, valor, offer_hash e saldo antes/depois do crédito.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Nesta página" value={rows.length} />
        <Stat label="Processados" value={summary.ok} />
        <Stat label="Com erro" value={summary.err} tone="danger" />
        <Stat label="Pendentes" value={summary.pending} tone="warn" />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              status === t.key
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              refetch();
            }
          }}
          placeholder="Buscar por tx id, event id ou erro…"
          className="flex-1 min-w-[220px] rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
        />
        <button
          onClick={() => {
            setPage(1);
            refetch();
          }}
          className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm hover:bg-white/5"
        >
          Buscar
        </button>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm hover:bg-white/5"
        >
          {isFetching ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0a0f1a]">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Offer hash</th>
              <th className="px-3 py-2">Tx / Evento</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Saldo antes</th>
              <th className="px-3 py-2">Saldo depois</th>
              <th className="px-3 py-2">Sig</th>
              <th className="px-3 py-2">Proc.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-white/50">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-rose-300">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-white/50">
                  Nenhum webhook encontrado.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2 whitespace-nowrap text-white/80">{fmtDate(r.created_at)}</td>
                <td className="px-3 py-2"><StatusBadge status={r.payment_status} /></td>
                <td className="px-3 py-2 font-medium">{fmtMoney(r.amount)}</td>
                <td className="px-3 py-2 font-mono text-xs text-white/70">{r.offer_hash ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-white/60">
                  <div>{r.provider_transaction_id ?? "—"}</div>
                  <div className="text-white/40">{r.event_id ?? ""}</div>
                </td>
                <td className="px-3 py-2 text-white/80">{r.user_name ?? r.user_id ?? "—"}</td>
                <td className="px-3 py-2 text-white/70">{fmtMoney(r.balance_before)}</td>
                <td className="px-3 py-2 text-emerald-300">{fmtMoney(r.balance_after)}</td>
                <td className="px-3 py-2">
                  {r.signature_valid == null ? (
                    <span className="text-white/40">—</span>
                  ) : r.signature_valid ? (
                    <span className="text-emerald-300">ok</span>
                  ) : (
                    <span className="text-rose-300">inv</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.processing_error ? (
                    <span className="text-rose-300" title={r.processing_error}>erro</span>
                  ) : r.processed ? (
                    <span className="text-emerald-300">sim</span>
                  ) : (
                    <span className="text-amber-300">não</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setSelected(r)}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-white/60">
        <div>
          Página {page} de {totalPages} · {total} registros
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-white/10 px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-white/10 px-3 py-1.5 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1a]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="text-sm font-semibold">Webhook {selected.id}</div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md border border-white/10 px-2 py-1 text-xs hover:bg-white/5"
              >
                Fechar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-white/5 px-4 py-3 text-sm">
              <Info label="Recebido em" value={fmtDate(selected.created_at)} />
              <Info label="Status" value={selected.payment_status ?? "—"} />
              <Info label="Valor" value={fmtMoney(selected.amount)} />
              <Info label="Offer hash" value={selected.offer_hash ?? "—"} />
              <Info label="Provider tx" value={selected.provider_transaction_id ?? "—"} />
              <Info label="Event id" value={selected.event_id ?? "—"} />
              <Info label="Usuário" value={selected.user_name ?? selected.user_id ?? "—"} />
              <Info label="Depósito" value={selected.deposit_status ?? "—"} />
              <Info label="Saldo antes" value={fmtMoney(selected.balance_before)} />
              <Info label="Saldo depois" value={fmtMoney(selected.balance_after)} />
              <Info label="Assinatura" value={selected.signature_valid == null ? "—" : selected.signature_valid ? "válida" : "inválida"} />
              <Info label="Processing error" value={selected.processing_error ?? "—"} />
            </div>
            <div className="max-h-[45vh] overflow-auto px-4 py-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-white/40">Payload bruto</div>
              <pre className="whitespace-pre-wrap break-all rounded-md border border-white/5 bg-black/40 p-3 text-xs text-white/80">
                {selected.raw_payload_json}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warn" }) {
  const color =
    tone === "danger" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : "text-cyan-300";
  return (
    <div className="rounded-xl border border-white/5 bg-[#0a0f1a] p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-0.5 break-all text-white/85">{value}</div>
    </div>
  );
}
