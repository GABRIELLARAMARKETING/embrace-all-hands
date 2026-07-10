import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listInviteCodes,
  listInviteCodeAudit,
  createInviteCode,
  setInviteCodeStatus,
  deleteInviteCode,
} from "@/lib/invite-codes.functions";
import { formatDate } from "@/utils/formatDate";

type Kind = "referral" | "affiliate" | "manager" | "invite";
type Status = "active" | "inactive" | "expired";

const codesQuery = (filters: { kind: Kind | "all"; status: Status | "all"; search: string }) =>
  queryOptions({
    queryKey: ["admin", "invite-codes", filters],
    queryFn: () => listInviteCodes({ data: filters }),
    staleTime: 10_000,
  });

const auditQuery = () =>
  queryOptions({
    queryKey: ["admin", "invite-codes", "audit"],
    queryFn: () => listInviteCodeAudit({ data: {} }),
    staleTime: 10_000,
  });

export const Route = createFileRoute("/admin/codes")({
  head: () => ({ meta: [{ title: "Códigos · Admin Helix" }] }),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

function Page() {
  const qc = useQueryClient();
  const fetchCodes = useServerFn(listInviteCodes);
  const fetchAudit = useServerFn(listInviteCodeAudit);
  const createFn = useServerFn(createInviteCode);
  const setStatusFn = useServerFn(setInviteCodeStatus);
  const deleteFn = useServerFn(deleteInviteCode);

  const [kind, setKind] = useState<Kind | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  const filters = { kind, status, search };
  const codes = useQuery({
    ...codesQuery(filters),
    queryFn: () => fetchCodes({ data: filters }),
  });
  const audit = useQuery({
    ...auditQuery(),
    queryFn: () => fetchAudit({ data: {} }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "invite-codes"] });
  };

  // form
  const [fKind, setFKind] = useState<Kind>("referral");
  const [fCode, setFCode] = useState("");
  const [fMax, setFMax] = useState<string>("");
  const [fExpires, setFExpires] = useState<string>("");
  const [fNotes, setFNotes] = useState("");

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof createFn>[0]["data"]) => createFn({ data: input }),
    onSuccess: () => {
      toast.success("Código criado");
      setFCode("");
      setFMax("");
      setFExpires("");
      setFNotes("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (input: { id: string; status: Status }) => setStatusFn({ data: input }),
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Código removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      kind: fKind,
      code: fCode.trim() || undefined,
      maxUses: fMax ? Number(fMax) : null,
      expiresAt: fExpires ? new Date(fExpires).toISOString() : null,
      notes: fNotes.trim() || null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Códigos</h1>
        <p className="text-sm text-white/50">
          Gere, liste, ative/desative e expire códigos com auditoria.
        </p>
      </div>

      {/* Criar */}
      <form
        onSubmit={submit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-6"
      >
        <select
          value={fKind}
          onChange={(e) => setFKind(e.target.value as Kind)}
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="referral">Referral</option>
          <option value="affiliate">Affiliate</option>
          <option value="manager">Manager</option>
          <option value="invite">Invite</option>
        </select>
        <input
          value={fCode}
          onChange={(e) => setFCode(e.target.value.toUpperCase())}
          placeholder="Código (vazio = auto)"
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          value={fMax}
          onChange={(e) => setFMax(e.target.value)}
          placeholder="Max usos"
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <input
          type="datetime-local"
          value={fExpires}
          onChange={(e) => setFExpires(e.target.value)}
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        <input
          value={fNotes}
          onChange={(e) => setFNotes(e.target.value)}
          placeholder="Observação"
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm md:col-span-1"
        />
        <button
          disabled={createMut.isPending}
          className="rounded-md bg-cyan-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {createMut.isPending ? "Gerando..." : "Gerar código"}
        </button>
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind | "all")}
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="all">Todos os tipos</option>
          <option value="referral">Referral</option>
          <option value="affiliate">Affiliate</option>
          <option value="manager">Manager</option>
          <option value="invite">Invite</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="expired">Expirados</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar código"
          className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Usos</th>
              <th className="px-3 py-2 text-left">Expira</th>
              <th className="px-3 py-2 text-left">Criado</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(codes.data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-white/40">
                  {codes.isFetching ? "Carregando..." : "Nenhum código."}
                </td>
              </tr>
            )}
            {(codes.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2 font-mono">{c.code}</td>
                <td className="px-3 py-2 text-white/70">{c.kind}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.uses}
                  {c.max_uses ? ` / ${c.max_uses}` : ""}
                </td>
                <td className="px-3 py-2 text-white/60">
                  {c.expires_at ? formatDate(c.expires_at) : "—"}
                </td>
                <td className="px-3 py-2 text-white/60">{formatDate(c.created_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {c.status !== "active" && (
                      <button
                        onClick={() => statusMut.mutate({ id: c.id, status: "active" })}
                        className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Ativar
                      </button>
                    )}
                    {c.status === "active" && (
                      <button
                        onClick={() => statusMut.mutate({ id: c.id, status: "inactive" })}
                        className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                      >
                        Desativar
                      </button>
                    )}
                    {c.status !== "expired" && (
                      <button
                        onClick={() => statusMut.mutate({ id: c.id, status: "expired" })}
                        className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
                      >
                        Expirar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Remover código ${c.code}?`)) delMut.mutate(c.id);
                      }}
                      className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Auditoria */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Auditoria</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
              <tr>
                <th className="px-3 py-2 text-left">Quando</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Ação</th>
                <th className="px-3 py-2 text-left">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-white/40">
                    Sem eventos.
                  </td>
                </tr>
              )}
              {(audit.data ?? []).map((a: any) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/60">{formatDate(a.created_at)}</td>
                  <td className="px-3 py-2 font-mono">{a.code}</td>
                  <td className="px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2 text-white/60">
                    {a.detail ? JSON.stringify(a.detail) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    inactive: "bg-white/5 text-white/60 border-white/15",
    expired: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  } as const;
  const label = { active: "Ativo", inactive: "Inativo", expired: "Expirado" }[status];
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs ${map[status]}`}>
      {label}
    </span>
  );
}
