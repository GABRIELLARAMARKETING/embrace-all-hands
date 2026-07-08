import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listManagers, setManagerStatus } from "@/lib/managers.functions";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const managersQuery = () =>
  queryOptions({
    queryKey: ["admin", "managers"],
    queryFn: () => listManagers(),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/managers")({
  head: () => ({ meta: [{ title: "Gerentes · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(managersQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

function Page() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listManagers);
  const setStatus = useServerFn(setManagerStatus);
  const { data = [], isFetching } = useQuery({
    ...managersQuery(),
    queryFn: () => fetchList(),
  });
  const [q, setQ] = useState("");

  const mut = useMutation({
    mutationFn: (input: { managerId: string; status: "active" | "inactive" | "blocked" }) =>
      setStatus({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "managers"] }),
  });

  const filtered = data.filter((m) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (m.display_name ?? "").toLowerCase().includes(s) ||
      (m.email ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Gerentes</h1>
        <p className="text-sm text-white/50">
          {isFetching ? "Atualizando..." : `${data.length} gerentes`}
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou e-mail"
        className="w-full max-w-sm rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
      />

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">E-mail</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Afiliados</th>
              <th className="px-3 py-2 text-right">Total gerado</th>
              <th className="px-3 py-2 text-left">Criado em</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-white/40">
                  Nenhum gerente encontrado.
                </td>
              </tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2">{m.display_name ?? "—"}</td>
                <td className="px-3 py-2 text-white/70">{m.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={m.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{m.affiliate_count}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(m.total_received)}
                </td>
                <td className="px-3 py-2 text-white/60">{formatDate(m.created_at)}</td>
                <td className="px-3 py-2 text-right">
                  {m.status !== "blocked" ? (
                    <button
                      disabled={mut.isPending}
                      onClick={() =>
                        mut.mutate({ managerId: m.id, status: "blocked" })
                      }
                      className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Bloquear
                    </button>
                  ) : (
                    <button
                      disabled={mut.isPending}
                      onClick={() =>
                        mut.mutate({ managerId: m.id, status: "active" })
                      }
                      className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Ativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" | "blocked" }) {
  const map = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    inactive: "bg-white/5 text-white/60 border-white/15",
    blocked: "bg-red-500/15 text-red-300 border-red-400/30",
  } as const;
  const label = { active: "Ativo", inactive: "Inativo", blocked: "Bloqueado" }[status];
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs ${map[status]}`}>
      {label}
    </span>
  );
}
