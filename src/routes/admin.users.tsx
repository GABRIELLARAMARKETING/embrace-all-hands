import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getAdminUsersStats,
  listAdminUsers,
  getAdminUserDetails,
  updateAdminUser,
  blockAdminUser,
  unblockAdminUser,
  deleteAdminUser,
  type AdminUserRow,
  type AdminUserDetails,
} from "@/lib/admin-users.functions";
import { formatDate } from "@/utils/formatDate";
import { X, RefreshCw, Download, Search, Copy, Ban, Check, Edit3, Eye, Trash2 } from "lucide-react";

const STATUS_OPTIONS = ["", "active", "pending", "blocked", "inactive"] as const;
const ROLE_OPTIONS = ["", "super_admin", "admin", "gerente", "afiliado", "user"] as const;

type Filters = {
  page: number;
  limit: number;
  search: string;
  cpf: string;
  phone: string;
  email: string;
  status: string;
  role: string;
  startDate: string;
  endDate: string;
};

const initialFilters: Filters = {
  page: 1,
  limit: 20,
  search: "",
  cpf: "",
  phone: "",
  email: "",
  status: "",
  role: "",
  startDate: "",
  endDate: "",
};

const statsQuery = () =>
  queryOptions({
    queryKey: ["admin", "users", "stats"],
    queryFn: () => getAdminUsersStats(),
    staleTime: 30_000,
  });

const usersQuery = (f: Filters) =>
  queryOptions({
    queryKey: ["admin", "users", "list", f],
    queryFn: () =>
      listAdminUsers({
        data: {
          page: f.page,
          limit: f.limit,
          search: f.search || undefined,
          cpf: f.cpf || undefined,
          phone: f.phone || undefined,
          email: f.email || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: (f.status || undefined) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: (f.role || undefined) as any,
          startDate: f.startDate || undefined,
          endDate: f.endDate || undefined,
          sortOrder: "desc",
        },
      }),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Usuários / Acessos · Admin Helix" }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(statsQuery()),
      context.queryClient.ensureQueryData(usersQuery(initialFilters)),
    ]),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="text-white/70">Página não encontrada.</div>,
});

function Card({ label, value, tone = "cyan" }: { label: string; value: number | string; tone?: string }) {
  const toneMap: Record<string, string> = {
    cyan: "border-cyan-400/20 text-cyan-200",
    green: "border-emerald-400/20 text-emerald-200",
    yellow: "border-amber-400/20 text-amber-200",
    red: "border-red-400/20 text-red-200",
    white: "border-white/10 text-white",
  };
  return (
    <div className={`rounded-lg border bg-white/[0.02] p-3 ${toneMap[tone] ?? toneMap.white}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-60">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Page() {
  const qc = useQueryClient();
  const fetchStats = useServerFn(getAdminUsersStats);
  const fetchList = useServerFn(listAdminUsers);
  const fetchDetails = useServerFn(getAdminUserDetails);
  const doUpdate = useServerFn(updateAdminUser);
  const doBlock = useServerFn(blockAdminUser);
  const doUnblock = useServerFn(unblockAdminUser);
  const doDelete = useServerFn(deleteAdminUser);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const { data: stats } = useQuery({
    ...statsQuery(),
    queryFn: () => fetchStats(),
  });
  const { data: listData, isFetching, error } = useQuery({
    ...usersQuery(filters),
    queryFn: () =>
      fetchList({
        data: {
          ...filters,
          search: filters.search || undefined,
          cpf: filters.cpf || undefined,
          phone: filters.phone || undefined,
          email: filters.email || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: (filters.status || undefined) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: (filters.role || undefined) as any,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          sortOrder: "desc",
        },
      }),
  });

  const users = listData?.users ?? [];
  const pagination = listData?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const update = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (input: any) => doUpdate({ data: input }),
    onSuccess: () => {
      setNotice({ kind: "ok", msg: "Usuário atualizado com sucesso" });
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => setNotice({ kind: "err", msg: e.message }),
  });

  const block = useMutation({
    mutationFn: (input: { id: string; reason: string }) => doBlock({ data: input }),
    onSuccess: () => {
      setNotice({ kind: "ok", msg: "Conta bloqueada com sucesso" });
      setBlockTarget(null);
      refresh();
    },
    onError: (e: Error) => setNotice({ kind: "err", msg: e.message }),
  });

  const unblock = useMutation({
    mutationFn: (input: { id: string; reason: string }) => doUnblock({ data: input }),
    onSuccess: () => {
      setNotice({ kind: "ok", msg: "Conta desbloqueada com sucesso" });
      refresh();
    },
    onError: (e: Error) => setNotice({ kind: "err", msg: e.message }),
  });

  const exportCsv = async () => {
    // Fetch up to 500 rows respecting filters
    const res = await fetchList({
      data: {
        ...filters,
        page: 1,
        limit: 100,
        search: filters.search || undefined,
        cpf: filters.cpf || undefined,
        phone: filters.phone || undefined,
        email: filters.email || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (filters.status || undefined) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: (filters.role || undefined) as any,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        sortOrder: "desc",
      },
    });
    const header = ["id", "name", "cpf", "phone", "email", "role", "status", "referred_by", "created_at", "last_login_at"];
    const csv = [header.join(",")]
      .concat(
        res.users.map((u) =>
          [
            u.id,
            JSON.stringify(u.name ?? ""),
            u.cpf ?? "",
            u.phone ?? "",
            u.email ?? "",
            u.role,
            u.status,
            JSON.stringify(u.referred_by_name ?? ""),
            u.created_at,
            u.last_login_at ?? "",
          ].join(","),
        ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 text-white">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Usuários / Acessos</h1>
        <p className="text-sm text-white/50">Gerencie cadastros, acessos e status dos usuários</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Card label="Total" value={stats?.totalUsers ?? "—"} />
        <Card label="Hoje" value={stats?.newUsersToday ?? "—"} tone="green" />
        <Card label="7 dias" value={stats?.newUsersLast7Days ?? "—"} tone="green" />
        <Card label="Ativos" value={stats?.activeUsers ?? "—"} tone="green" />
        <Card label="Pendentes" value={stats?.pendingUsers ?? "—"} tone="yellow" />
        <Card label="Bloqueados" value={stats?.blockedUsers ?? "—"} tone="red" />
        <Card label="Com CPF" value={stats?.usersWithCpf ?? "—"} />
        <Card label="Sem telefone" value={stats?.usersWithoutPhone ?? "—"} tone="yellow" />
      </div>

      {notice && (
        <div
          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
            notice.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-white/40" />
          <input
            className="w-full rounded-md border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-sm outline-none focus:border-cyan-400/60"
            placeholder="Buscar por nome ou e-mail"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
        </div>
        <input
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          placeholder="CPF"
          value={filters.cpf}
          onChange={(e) => setFilters({ ...filters, cpf: e.target.value, page: 1 })}
        />
        <input
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          placeholder="Telefone"
          value={filters.phone}
          onChange={(e) => setFilters({ ...filters, phone: e.target.value, page: 1 })}
        />
        <input
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          placeholder="E-mail"
          value={filters.email}
          onChange={(e) => setFilters({ ...filters, email: e.target.value, page: 1 })}
        />
        <select
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? `Status: ${s}` : "Status: todos"}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r || "all"} value={r}>
              {r ? `Tipo: ${r}` : "Tipo: todos"}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
        />
        <input
          type="date"
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
        />
        <div className="flex gap-2 md:col-span-4">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
          <button
            onClick={() => setFilters(initialFilters)}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">CPF</th>
              <th className="px-3 py-2">Telefone</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Indicado por</th>
              <th className="px-3 py-2">Cadastro</th>
              <th className="px-3 py-2">Último acesso</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isFetching && !users.length && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-white/60">
                  Carregando usuários...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-red-300">
                  Erro ao carregar usuários: {(error as Error).message}
                </td>
              </tr>
            )}
            {!isFetching && !users.length && !error && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-white/50">
                  Nenhum usuário encontrado
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2 font-medium">{u.name ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{u.cpf ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{u.phone ?? "—"}</td>
                <td className="px-3 py-2">{u.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs">{u.role}</span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-3 py-2 text-white/70">{u.referred_by_name ?? "—"}</td>
                <td className="px-3 py-2 text-white/60">{formatDate(u.created_at)}</td>
                <td className="px-3 py-2 text-white/60">{u.last_login_at ? formatDate(u.last_login_at) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <IconBtn title="Ver detalhes" onClick={() => setSelectedId(u.id)}>
                      <Eye className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn title="Editar" onClick={() => setEditing(u)}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </IconBtn>
                    {u.affiliate_code && (
                      <IconBtn
                        title="Copiar código"
                        onClick={() => {
                          navigator.clipboard.writeText(u.affiliate_code!);
                          setNotice({ kind: "ok", msg: `Código ${u.affiliate_code} copiado` });
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </IconBtn>
                    )}
                    {u.status === "blocked" ? (
                      <IconBtn
                        title="Desbloquear"
                        onClick={() => unblock.mutate({ id: u.id, reason: "Conta revisada" })}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      </IconBtn>
                    ) : (
                      <IconBtn title="Bloquear" onClick={() => setBlockTarget(u)}>
                        <Ban className="h-3.5 w-3.5 text-red-300" />
                      </IconBtn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-white/60">
        <div>
          {pagination.total} usuário(s) · página {pagination.page} de {pagination.totalPages}
        </div>
        <div className="flex gap-2">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            disabled={filters.page >= pagination.totalPages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>

      {/* Details modal */}
      {selectedId && (
        <DetailsModal
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          fetchDetails={fetchDetails}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          user={editing}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSave={(patch: any) => update.mutate({ id: editing.id, ...patch })}
        />
      )}

      {/* Block confirm */}
      {blockTarget && (
        <BlockModal
          user={blockTarget}
          saving={block.isPending}
          onClose={() => setBlockTarget(null)}
          onConfirm={(reason) => block.mutate({ id: blockTarget.id, reason })}
        />
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-md border border-white/10 bg-white/5 p-1.5 hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    pending: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    blocked: "border-red-400/30 bg-red-500/10 text-red-200",
    inactive: "border-white/20 bg-white/5 text-white/70",
  };
  return (
    <span className={`rounded border px-2 py-0.5 text-xs ${map[status] ?? map.inactive}`}>{status}</span>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#0a0f1a] p-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailsModal({
  userId,
  onClose,
  fetchDetails,
}: {
  userId: string;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchDetails: any;
}) {
  const { data, isLoading, error } = useQuery<AdminUserDetails>({
    queryKey: ["admin", "users", "details", userId],
    queryFn: () => fetchDetails({ data: { id: userId } }),
    staleTime: 0,
  });
  return (
    <ModalShell title="Detalhes do Usuário" onClose={onClose}>
      {isLoading && <div className="text-white/60">Carregando...</div>}
      {error && <div className="text-red-300">{(error as Error).message}</div>}
      {data && (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Nome" value={data.name ?? "—"} />
            <Field label="E-mail" value={data.email ?? "—"} />
            <Field label="CPF" value={data.cpf ?? "—"} />
            <Field label="Telefone" value={data.phone ?? "—"} />
            <Field label="Tipo" value={data.role} />
            <Field label="Status" value={data.status} />
            <Field label="Código" value={data.affiliate_code ?? "—"} />
            <Field label="Indicado por" value={data.referred_by_name ?? "—"} />
            <Field label="Cadastro" value={formatDate(data.created_at)} />
            <Field label="Último acesso" value={data.last_login_at ? formatDate(data.last_login_at) : "—"} />
            <Field label="Saldo" value={`R$ ${data.balance.toFixed(2)}`} />
          </div>
          <Section title={`Indicados (${data.referrals.length})`}>
            {data.referrals.length ? (
              <ul className="space-y-1">
                {data.referrals.map((r) => (
                  <li key={r.id} className="flex justify-between border-b border-white/5 py-1">
                    <span>{r.name ?? r.id}</span>
                    <span className="text-white/50">{formatDate(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/50">Sem indicações.</div>
            )}
          </Section>
          <Section title={`Histórico admin (${data.logs.length})`}>
            {data.logs.length ? (
              <ul className="space-y-1">
                {data.logs.map((l) => (
                  <li key={l.id} className="border-b border-white/5 py-1">
                    <span className="font-mono text-xs text-cyan-200">{l.action}</span>{" "}
                    <span className="text-white/50">· {formatDate(l.created_at)}</span>
                    {l.reason && <div className="text-xs text-white/60">{l.reason}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/50">Sem histórico.</div>
            )}
          </Section>
          <Section title={`Últimos logins (${data.loginHistory.length})`}>
            {data.loginHistory.length ? (
              <ul className="space-y-1">
                {data.loginHistory.map((l, i) => (
                  <li key={i} className="flex justify-between border-b border-white/5 py-1">
                    <span>
                      {l.success ? "✅" : "❌"} {l.ip ?? "—"}
                    </span>
                    <span className="text-white/50">{formatDate(l.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/50">Sem logins registrados.</div>
            )}
          </Section>
        </div>
      )}
    </ModalShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-xs uppercase tracking-widest text-white/50">{title}</div>
      {children}
    </div>
  );
}

function EditModal({
  user,
  saving,
  onClose,
  onSave,
}: {
  user: AdminUserRow;
  saving: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (patch: any) => void;
}) {
  const [full_name, setName] = useState(user.name ?? "");
  const [cpf, setCpf] = useState(user.cpf ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [status, setStatus] = useState<string>(user.status);
  const [role, setRole] = useState<string>(user.role);
  const [reason, setReason] = useState("");
  const [confirmRole, setConfirmRole] = useState(false);

  const roleChanged = role !== user.role;

  const submit = () => {
    if (roleChanged && !confirmRole) {
      setConfirmRole(true);
      return;
    }
    onSave({ full_name, cpf: cpf || null, phone: phone || null, status, role, reason: reason || undefined });
  };

  return (
    <ModalShell title={`Editar usuário — ${user.name ?? user.email}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <div className="mb-1 text-xs text-white/60">Nome completo</div>
          <input className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" value={full_name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid gap-2 md:grid-cols-2">
          <label>
            <div className="mb-1 text-xs text-white/60">CPF</div>
            <input className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </label>
          <label>
            <div className="mb-1 text-xs text-white/60">Telefone</div>
            <input className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            <div className="mb-1 text-xs text-white/60">Status</div>
            <select className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <div className="mb-1 text-xs text-white/60">Tipo</div>
            <select className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" value={role} onChange={(e) => { setRole(e.target.value); setConfirmRole(false); }}>
              {ROLE_OPTIONS.filter(Boolean).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <div className="mb-1 text-xs text-white/60">Motivo (opcional, registrado no log)</div>
          <input className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {roleChanged && confirmRole && (
          <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-200">
            Alterar o tipo de usuário afeta permissões. Clique em Salvar novamente para confirmar.
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">Cancelar</button>
          <button
            disabled={saving}
            onClick={submit}
            className="rounded-md border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {saving ? "Salvando alterações..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function BlockModal({ user, saving, onClose, onConfirm }: { user: AdminUserRow; saving: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const canSubmit = useMemo(() => reason.trim().length >= 3, [reason]);
  return (
    <ModalShell title={`Bloquear ${user.name ?? user.email}?`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-white/70">Esta ação bloqueia o acesso da conta. Informe o motivo:</p>
        <input
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          placeholder="Motivo do bloqueio"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">Cancelar</button>
          <button
            disabled={!canSubmit || saving}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md border border-red-400/40 bg-red-500/20 px-4 py-2 text-red-100 hover:bg-red-500/30 disabled:opacity-50"
          >
            {saving ? "Bloqueando..." : "Confirmar bloqueio"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
