import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Ban, CheckCircle2, PauseCircle, Users, X } from "lucide-react";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminButton } from "@/components/admin/AdminButton";
import { Badge } from "@/components/admin/Badge";
import { EmptyState } from "@/components/admin/EmptyState";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import {
  listManagers,
  setManagerStatus,
  listAffiliatesForManager,
  type ManagerRow,
  type AffiliateRow,
} from "@/lib/managers.functions";

export const Route = createFileRoute("/gerente/gerentes")({
  head: () => ({
    meta: [
      { title: "Gerentes · Painel Gerente" },
      { name: "description", content: "Gestão de gerentes, bloqueio e afiliados vinculados." },
    ],
  }),
  component: GerentesAdminPage,
});

type StatusFilter = "all" | "active" | "inactive" | "blocked";

const statusMeta: Record<
  ManagerRow["status"],
  { label: string; tone: "green" | "neutral" | "red" }
> = {
  active: { label: "Ativo", tone: "green" },
  inactive: { label: "Inativo", tone: "neutral" },
  blocked: { label: "Bloqueado", tone: "red" },
};

function GerentesAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listManagers);
  const setStatusFn = useServerFn(setManagerStatus);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [viewing, setViewing] = useState<ManagerRow | null>(null);

  const query = useQuery({
    queryKey: ["admin-managers"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  const rows = useMemo(() => {
    const all = query.data ?? [];
    return filter === "all" ? all : all.filter((r) => r.status === filter);
  }, [query.data, filter]);

  const counts = useMemo(() => {
    const all = query.data ?? [];
    return {
      active: all.filter((r) => r.status === "active").length,
      inactive: all.filter((r) => r.status === "inactive").length,
      blocked: all.filter((r) => r.status === "blocked").length,
    };
  }, [query.data]);

  const statusMut = useMutation({
    mutationFn: (input: { managerId: string; status: ManagerRow["status"] }) =>
      setStatusFn({ data: input }),
    onSuccess: (_res, vars) => {
      toast.success(
        vars.status === "blocked"
          ? "Gerente bloqueado."
          : vars.status === "inactive"
            ? "Gerente desativado."
            : "Gerente ativado.",
      );
      qc.invalidateQueries({ queryKey: ["admin-managers"] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar."),
  });

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "inactive", label: "Inativos" },
    { key: "blocked", label: "Bloqueados" },
  ];

  return (
    <>
      <TopHeader
        title="Gerentes"
        subtitle="Bloqueie, ative/desative e veja os afiliados vinculados a cada gerente."
        context={`${counts.active} ativo(s) · ${counts.inactive} inativo(s) · ${counts.blocked} bloqueado(s)`}
      />
      <div className="space-y-4 p-4 sm:p-5">
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                    (filter === f.key
                      ? "border-[color:var(--admin-green)]/40 bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]"
                      : "border-[color:var(--admin-border)] bg-transparent text-[color:var(--admin-text-2)] hover:bg-white/[0.03]")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <AdminButton
              variant="ghost"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
              Atualizar
            </AdminButton>
          </div>
        </AdminCard>

        <AdminCard padding="sm">
          <AdminTable<ManagerRow>
            rows={rows}
            getRowKey={(r) => r.id}
            emptyState={<EmptyState message="Nenhum gerente encontrado para este filtro." />}
            columns={[
              {
                key: "manager",
                header: "Gerente",
                render: (r) => (
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {r.display_name ?? "—"}
                    </p>
                    <p className="truncate text-[11px] text-[color:var(--admin-text-3)]">
                      {r.email ?? r.id.slice(0, 8)}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => {
                  const m = statusMeta[r.status];
                  return <Badge tone={m.tone}>{m.label}</Badge>;
                },
              },
              {
                key: "affiliates",
                header: "Afiliados",
                render: (r) => (
                  <span className="tabular-nums text-white">{r.affiliate_count}</span>
                ),
              },
              {
                key: "total",
                header: "Total recebido",
                render: (r) => (
                  <span className="tabular-nums text-white">
                    {formatCurrency(r.total_received / 100)}
                  </span>
                ),
              },
              {
                key: "created",
                header: "Criado em",
                render: (r) => (
                  <span className="text-xs text-[color:var(--admin-text-2)]">
                    {formatDate(r.created_at)}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Ações",
                render: (r) => {
                  const busy =
                    statusMut.isPending && statusMut.variables?.managerId === r.id;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      <AdminButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewing(r)}
                      >
                        <Users size={12} />
                        Afiliados
                      </AdminButton>
                      {r.status !== "active" && (
                        <AdminButton
                          size="sm"
                          onClick={() =>
                            statusMut.mutate({ managerId: r.id, status: "active" })
                          }
                          loading={busy && statusMut.variables?.status === "active"}
                        >
                          <CheckCircle2 size={12} />
                          Ativar
                        </AdminButton>
                      )}
                      {r.status === "active" && (
                        <AdminButton
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            statusMut.mutate({ managerId: r.id, status: "inactive" })
                          }
                          loading={busy && statusMut.variables?.status === "inactive"}
                        >
                          <PauseCircle size={12} />
                          Desativar
                        </AdminButton>
                      )}
                      {r.status !== "blocked" && (
                        <AdminButton
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (
                              confirm(
                                `Bloquear ${r.display_name ?? "gerente"}? A ação será registrada em auditoria.`,
                              )
                            ) {
                              statusMut.mutate({ managerId: r.id, status: "blocked" });
                            }
                          }}
                          loading={busy && statusMut.variables?.status === "blocked"}
                        >
                          <Ban size={12} />
                          Bloquear
                        </AdminButton>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </AdminCard>

        {query.isError && (
          <AdminCard className="border-[color:var(--admin-red)]/40 bg-[color:var(--admin-red)]/8">
            <p className="text-sm text-[color:var(--admin-red)]">
              Erro ao carregar gerentes: {(query.error as Error).message}
            </p>
          </AdminCard>
        )}
      </div>

      {viewing && (
        <AffiliatesDialog manager={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

function AffiliatesDialog({
  manager,
  onClose,
}: {
  manager: ManagerRow;
  onClose: () => void;
}) {
  const listFn = useServerFn(listAffiliatesForManager);
  const q = useQuery({
    queryKey: ["admin-manager-affiliates", manager.id],
    queryFn: () => listFn({ data: { managerId: manager.id } }),
    staleTime: 15_000,
  });

  const rows: AffiliateRow[] = q.data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-[14px] border border-[color:var(--admin-border)] bg-[color:var(--admin-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md text-[color:var(--admin-text-2)] hover:bg-white/[0.06] hover:text-white"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Afiliados vinculados</h3>
          <p className="text-sm text-[color:var(--admin-text-2)]">
            {manager.display_name ?? "Gerente"} · {manager.email ?? "sem e-mail"}
          </p>
        </div>

        {q.isError ? (
          <EmptyState
            message={q.error instanceof Error ? q.error.message : "Erro ao carregar."}
          />
        ) : q.isLoading ? (
          <p className="py-8 text-center text-sm text-[color:var(--admin-text-3)]">
            Carregando…
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <AdminTable<AffiliateRow>
              rows={rows}
              getRowKey={(r) => r.id}
              emptyState={
                <EmptyState message="Este gerente ainda não possui afiliados vinculados." />
              }
              columns={[
                {
                  key: "aff",
                  header: "Afiliado",
                  render: (a) => (
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">
                        {a.display_name ?? "—"}
                      </p>
                      <p className="truncate text-[11px] text-[color:var(--admin-text-3)]">
                        {a.email ?? a.id.slice(0, 8)}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (a) => {
                    const m = statusMeta[a.status];
                    return <Badge tone={m.tone}>{m.label}</Badge>;
                  },
                },
                {
                  key: "balance",
                  header: "Saldo",
                  render: (a) => (
                    <span className="tabular-nums text-white">
                      {formatCurrency(a.affiliate_balance / 100)}
                    </span>
                  ),
                },
                {
                  key: "total",
                  header: "Total recebido",
                  render: (a) => (
                    <span className="tabular-nums text-white">
                      {formatCurrency(a.total_received / 100)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
