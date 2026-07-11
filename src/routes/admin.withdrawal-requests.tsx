import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWithdrawalRequests } from "@/lib/admin-withdrawal-requests.functions";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";

export const Route = createFileRoute("/admin/withdrawal-requests")({
  head: () => ({ meta: [{ title: "Solicitações de Saque · Admin Helix" }] }),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="text-white/60">Não encontrado.</div>,
});

const STATUSES = [
  { key: "", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "in_review", label: "Em análise" },
  { key: "approved", label: "Aprovados" },
  { key: "paid", label: "Pagos" },
  { key: "rejected", label: "Recusados" },
  { key: "cancelled", label: "Cancelados" },
  { key: "failed", label: "Falhou" },
] as const;

const NOTIFS = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "read", label: "Lidas" },
  { key: "none", label: "Sem notificação" },
] as const;

const PAGE_SIZE = 20;

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listWithdrawalRequests);

  const [status, setStatus] = useState<string>("");
  const [notifications, setNotifications] =
    useState<(typeof NOTIFS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useAdminRealtime({
    table: "affiliate_withdrawals",
    invalidateKeys: [["admin", "withdrawal-requests"]],
  });

  const filterKey = `${status}|${notifications}|${search.trim()}|${from}|${to}`;
  useMemo(() => {
    setPage(0);
    return filterKey;
  }, [filterKey]);

  const args = {
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(to).toISOString() } : {}),
    notifications,
    page,
    pageSize: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: ["admin", "withdrawal-requests", args],
    queryFn: () => list({ data: args as never }),
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
          <h1 className="mt-1 text-2xl font-semibold">Solicitações de saque</h1>
          <p className="text-sm text-white/50">
            {query.isFetching
              ? "Atualizando..."
              : `${total} registro(s) · página ${page + 1} de ${totalPages}`}
          </p>
        </div>
        <button
          onClick={() =>
            qc.invalidateQueries({ queryKey: ["admin", "withdrawal-requests"] })
          }
          className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.08]"
        >
          Atualizar
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 md:grid-cols-[repeat(4,minmax(0,1fr))]">
        <div className="md:col-span-4 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={`rounded-md border px-3 py-1 text-xs ${
                status === s.key
                  ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.06]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="md:col-span-4 flex flex-wrap gap-2">
          {NOTIFS.map((n) => (
            <button
              key={n.key}
              onClick={() => setNotifications(n.key)}
              className={`rounded-md border px-3 py-1 text-xs ${
                notifications === n.key
                  ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                  : "border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.06]"
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col text-[11px] uppercase tracking-widest text-white/40">
          Buscar
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou ID do usuário"
            className="mt-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm normal-case tracking-normal text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
          />
        </label>
        <label className="flex flex-col text-[11px] uppercase tracking-widest text-white/40">
          De
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
          />
        </label>
        <label className="flex flex-col text-[11px] uppercase tracking-widest text-white/40">
          Até
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={() => {
              setStatus("");
              setNotifications("all");
              setSearch("");
              setFrom("");
              setTo("");
            }}
            className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.06]"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
            <tr>
              <th className="w-6 px-3 py-2" />
              <th className="px-3 py-2 text-left">Solicitado em</th>
              <th className="px-3 py-2 text-left">Usuário</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Eventos</th>
              <th className="px-3 py-2 text-left">Notificações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !query.isFetching && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-white/40">
                  Nenhuma solicitação para os filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((w) => {
              const open = expanded === w.id;
              return (
                <Fragment key={w.id}>
                  <tr
                    className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]"
                    onClick={() => setExpanded(open ? null : w.id)}
                  >
                    <td className="px-3 py-2 text-white/40">{open ? "▾" : "▸"}</td>
                    <td className="px-3 py-2 text-white/70">
                      {formatDate(w.created_at)}
                    </td>
                    <td className="px-3 py-2 text-white/90">
                      {w.user_display_name ?? w.user_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(w.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="px-3 py-2 text-white/60">{w.events.length}</td>
                    <td className="px-3 py-2 text-white/60">
                      {w.notifications.length}
                      {w.unread_notifications > 0 && (
                        <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                          {w.unread_notifications} nova(s)
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr key={w.id + "-detail"} className="bg-white/[0.02]">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                              Eventos de auditoria
                            </div>
                            {w.events.length === 0 && (
                              <div className="text-xs text-white/40">Sem eventos.</div>
                            )}
                            <ul className="space-y-1">
                              {w.events.map((e) => (
                                <li
                                  key={e.id}
                                  className="rounded-md border border-white/10 bg-white/[0.02] p-2 text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-cyan-200">
                                      {e.event_type}
                                    </span>
                                    <span className="text-white/40">
                                      {formatDate(e.created_at)}
                                    </span>
                                  </div>
                                  {e.title && (
                                    <div className="mt-0.5 text-white/80">{e.title}</div>
                                  )}
                                  {e.message && (
                                    <div className="text-white/50">{e.message}</div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                              Notificações admin
                            </div>
                            {w.notifications.length === 0 && (
                              <div className="text-xs text-white/40">
                                Nenhuma notificação gerada.
                              </div>
                            )}
                            <ul className="space-y-1">
                              {w.notifications.map((n) => (
                                <li
                                  key={n.id}
                                  className="rounded-md border border-white/10 bg-white/[0.02] p-2 text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-amber-200">
                                      {n.type}
                                    </span>
                                    <span className="text-white/40">
                                      {formatDate(n.created_at)}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 text-white/80">{n.title}</div>
                                  <div className="text-[11px] text-white/50">
                                    {n.read_at
                                      ? `Lida em ${formatDate(n.read_at)}`
                                      : "Não lida"}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {(w.admin_notes || w.rejection_reason) && (
                            <div className="md:col-span-2 rounded-md border border-white/10 bg-white/[0.02] p-2 text-xs text-white/70">
                              {w.admin_notes && (
                                <div>
                                  <span className="text-white/40">Nota admin: </span>
                                  {w.admin_notes}
                                </div>
                              )}
                              {w.rejection_reason && (
                                <div>
                                  <span className="text-white/40">Motivo recusa: </span>
                                  {w.rejection_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <div>
          {total === 0
            ? "Nenhum registro"
            : `Mostrando ${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} de ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || query.isFetching}
            className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-white/60">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages || query.isFetching}
            className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-1 text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    in_review: "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
    approved: "bg-violet-500/15 text-violet-200 border-violet-400/30",
    paid: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    rejected: "bg-red-500/15 text-red-200 border-red-400/30",
    cancelled: "bg-white/5 text-white/60 border-white/15",
    failed: "bg-red-500/15 text-red-200 border-red-400/30",
  };
  const label: Record<string, string> = {
    pending: "Pendente",
    in_review: "Em análise",
    approved: "Aprovado",
    paid: "Pago",
    rejected: "Recusado",
    cancelled: "Cancelado",
    failed: "Falhou",
  };
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs ${
        map[status] ?? "bg-white/5 text-white/60 border-white/15"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}
