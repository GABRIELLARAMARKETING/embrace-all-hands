import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Search } from "lucide-react";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminInput } from "@/components/admin/AdminInput";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { listNetworkWithdrawals } from "@/lib/manager.functions";

export const Route = createFileRoute("/gerente/saques")({
  head: () => ({
    meta: [
      { title: "Saques da Rede · Painel Gerente" },
      { name: "description", content: "Acompanhe os saques dos afiliados da sua rede." },
    ],
  }),
  component: SaquesGerentePage,
});

type StatusFilter =
  | "all"
  | "pending"
  | "in_review"
  | "approved"
  | "paid"
  | "rejected"
  | "cancelled"
  | "failed";

const statusMeta: Record<
  string,
  { label: string; tone: "green" | "neutral" | "blue" | "purple" | "red" }
> = {
  pending: { label: "Pendente", tone: "purple" },
  in_review: { label: "Em análise", tone: "blue" },
  approved: { label: "Aprovado", tone: "green" },
  paid: { label: "Pago", tone: "green" },
  rejected: { label: "Recusado", tone: "red" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  failed: { label: "Falhou", tone: "red" },
};

const PAGE_SIZE = 20;

function SaquesGerentePage() {
  const qc = useQueryClient();
  const list = useServerFn(listNetworkWithdrawals);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // reset página ao mudar filtros
  const filterKey = `${status}|${search.trim()}`;
  useMemo(() => {
    setPage(0);
    return filterKey;
  }, [filterKey]);

  const query = useQuery({
    queryKey: ["gerente", "network-withdrawals", status, search, page],
    queryFn: () =>
      list({
        data: {
          ...(status === "all" ? {} : { status }),
          ...(search.trim() ? { search: search.trim() } : {}),
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageCounts = useMemo(() => {
    const c = { pending: 0, approved: 0, paid: 0 };
    for (const r of rows) {
      if (r.status === "pending" || r.status === "in_review") c.pending++;
      else if (r.status === "approved") c.approved++;
      else if (r.status === "paid") c.paid++;
    }
    return c;
  }, [rows]);

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendentes" },
    { key: "approved", label: "Aprovados" },
    { key: "paid", label: "Pagos" },
    { key: "rejected", label: "Recusados" },
  ];

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["gerente", "network-withdrawals"] });

  return (
    <>
      <TopHeader
        title="Saques da rede"
        subtitle="Solicitações de saque dos afiliados vinculados a você"
        context={`${total} registro(s) · página ${page + 1}/${totalPages} · ${pageCounts.pending} pend. · ${pageCounts.approved} aprov. · ${pageCounts.paid} pago(s)`}
      />

      <div className="space-y-4 p-4 sm:p-5">
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatus(f.key)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                    (status === f.key
                      ? "border-[color:var(--admin-green)]/40 bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]"
                      : "border-[color:var(--admin-border)] bg-transparent text-[color:var(--admin-text-2)] hover:bg-white/[0.03]")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center gap-2 sm:flex-none">
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-text-3)]"
                />
                <AdminInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou ID"
                  className="pl-8"
                />
              </div>
              <AdminButton
                variant="ghost"
                onClick={refresh}
                disabled={query.isFetching}
              >
                <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
                Atualizar
              </AdminButton>
            </div>
          </div>
        </AdminCard>

        <AdminCard padding="sm">
          <AdminTable
            rows={rows}
            getRowKey={(r) => r.id}
            emptyState={
              <EmptyState message="Nenhum saque encontrado para os filtros aplicados." />
            }
            columns={[
              {
                key: "user",
                header: "Afiliado",
                render: (r) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {r.userDisplayName ?? "—"}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[color:var(--admin-text-3)]">
                      {r.userId.slice(0, 8)}
                    </p>
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Valor",
                render: (r) => (
                  <span className="font-semibold text-white">
                    {formatCurrency(r.amount)}
                  </span>
                ),
              },
              {
                key: "pix",
                header: "PIX",
                render: (r) => (
                  <span className="font-mono text-xs text-[color:var(--admin-text-2)]">
                    {r.pixKey || "—"}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => {
                  const m =
                    statusMeta[r.status] ?? { label: r.status, tone: "neutral" as const };
                  return <Badge tone={m.tone}>{m.label}</Badge>;
                },
              },
              {
                key: "created",
                header: "Solicitado em",
                render: (r) => (
                  <span className="text-xs text-[color:var(--admin-text-2)]">
                    {formatDate(r.createdAt)}
                  </span>
                ),
              },
              {
                key: "paid",
                header: "Pago em",
                render: (r) => (
                  <span className="text-xs text-[color:var(--admin-text-2)]">
                    {r.paidAt ? formatDate(r.paidAt) : "—"}
                  </span>
                ),
              },
            ]}
          />
        </AdminCard>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-[color:var(--admin-text-3)]">
            {total === 0
              ? "Nenhum registro"
              : `Mostrando ${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} de ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <AdminButton
              variant="ghost"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || query.isFetching}
            >
              Anterior
            </AdminButton>
            <span className="text-xs text-[color:var(--admin-text-2)]">
              {page + 1} / {totalPages}
            </span>
            <AdminButton
              variant="ghost"
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages || query.isFetching}
            >
              Próxima
            </AdminButton>
          </div>
        </div>


        {query.isError && (
          <AdminCard className="border-[color:var(--admin-red)]/40 bg-[color:var(--admin-red)]/8">
            <p className="text-sm text-[color:var(--admin-red)]">
              Erro ao carregar saques: {(query.error as Error).message}
            </p>
          </AdminCard>
        )}
      </div>
    </>
  );
}
