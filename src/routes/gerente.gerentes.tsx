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

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-managers"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    return filter === "all" ? all : all.filter((r) => r.status === filter);
  }, [data, filter]);

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

  return (
    <div className="flex flex-col gap-6">
      <TopHeader
        title="Gerentes"
        subtitle="Gerencie contas de gerentes: bloquear, ativar/desativar e ver afiliados vinculados."
      />

      <AdminCard
        title="Filtros"
        right={
          <AdminButton
            variant="ghost"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Atualizar
          </AdminButton>
        }
      >
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "inactive", "blocked"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? "border-[color:var(--admin-neon)] bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]"
                  : "border-[color:var(--admin-line)] text-[color:var(--admin-text-2)] hover:text-white"
              }`}
            >
              {s === "all" ? "Todos" : statusMeta[s as ManagerRow["status"]].label}
            </button>
          ))}
        </div>
      </AdminCard>

      <AdminCard title={`Gerentes (${rows.length})`}>
        {error ? (
          <EmptyState
            title="Erro ao carregar"
            description={error instanceof Error ? error.message : "Tente novamente."}
          />
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-[color:var(--admin-text-3)]">
            Carregando…
          </p>
        ) : !rows.length ? (
          <EmptyState
            title="Nenhum gerente"
            description="Nenhum gerente encontrado para o filtro atual."
          />
        ) : (
          <AdminTable>
            <thead>
              <tr>
                <th>Gerente</th>
                <th>E-mail</th>
                <th>Status</th>
                <th className="text-right">Afiliados</th>
                <th className="text-right">Total recebido</th>
                <th>Criado em</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const meta = statusMeta[m.status];
                const busy = statusMut.isPending && statusMut.variables?.managerId === m.id;
                return (
                  <tr key={m.id}>
                    <td className="font-medium text-white">
                      {m.display_name ?? "—"}
                    </td>
                    <td className="text-[color:var(--admin-text-2)]">
                      {m.email ?? "—"}
                    </td>
                    <td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="text-right tabular-nums">{m.affiliate_count}</td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(m.total_received)}
                    </td>
                    <td className="text-[color:var(--admin-text-3)]">
                      {formatDate(m.created_at)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <AdminButton
                          variant="ghost"
                          onClick={() => setViewing(m)}
                          title="Ver afiliados vinculados"
                        >
                          <Users size={14} /> Afiliados
                        </AdminButton>
                        {m.status !== "active" && (
                          <AdminButton
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              statusMut.mutate({ managerId: m.id, status: "active" })
                            }
                            title="Ativar"
                          >
                            <CheckCircle2 size={14} /> Ativar
                          </AdminButton>
                        )}
                        {m.status !== "inactive" && m.status !== "blocked" && (
                          <AdminButton
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              statusMut.mutate({ managerId: m.id, status: "inactive" })
                            }
                            title="Desativar"
                          >
                            <PauseCircle size={14} /> Desativar
                          </AdminButton>
                        )}
                        {m.status !== "blocked" && (
                          <AdminButton
                            variant="danger"
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  `Bloquear ${m.display_name ?? "gerente"}? Esta ação será registrada em auditoria.`,
                                )
                              ) {
                                statusMut.mutate({ managerId: m.id, status: "blocked" });
                              }
                            }}
                            title="Bloquear"
                          >
                            <Ban size={14} /> Bloquear
                          </AdminButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </AdminCard>

      {viewing && (
        <AffiliatesDialog manager={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
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
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-manager-affiliates", manager.id],
    queryFn: () => listFn({ data: { managerId: manager.id } }),
    staleTime: 15_000,
  });

  const rows: AffiliateRow[] = data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-[14px] border border-[color:var(--admin-line)] bg-[color:var(--admin-panel)] p-6"
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
          <h3 className="text-lg font-semibold text-white">
            Afiliados vinculados
          </h3>
          <p className="text-sm text-[color:var(--admin-text-2)]">
            {manager.display_name ?? "Gerente"} · {manager.email ?? "sem e-mail"}
          </p>
        </div>

        {error ? (
          <EmptyState
            title="Erro ao carregar"
            description={error instanceof Error ? error.message : "Tente novamente."}
          />
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-[color:var(--admin-text-3)]">
            Carregando…
          </p>
        ) : !rows.length ? (
          <EmptyState
            title="Nenhum afiliado"
            description="Este gerente ainda não possui afiliados vinculados."
          />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <AdminTable>
              <thead>
                <tr>
                  <th>Afiliado</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Total recebido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const meta = statusMeta[a.status];
                  return (
                    <tr key={a.id}>
                      <td className="font-medium text-white">
                        {a.display_name ?? "—"}
                      </td>
                      <td className="text-[color:var(--admin-text-2)]">
                        {a.email ?? "—"}
                      </td>
                      <td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="text-right tabular-nums">
                        {formatCurrency(a.affiliate_balance)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatCurrency(a.total_received)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>
        )}
      </div>
    </div>
  );
}
