import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, UserCog, Lock, Unlock, Network, Search } from "lucide-react";
import {
  listReferralOverview,
  getReferralNetwork,
  updateAffiliate,
  type ReferralOverviewNode,
} from "@/lib/admin.functions";
import { formatCurrency } from "@/utils/formatCurrency";

const overviewQuery = () =>
  queryOptions({
    queryKey: ["admin", "referral-overview"],
    queryFn: () => listReferralOverview(),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/network")({
  head: () => ({
    meta: [
      { title: "Rede de Indicações · Admin Helix" },
      { name: "description", content: "Multiníveis e rede de indicações da plataforma." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery()),
  component: NetworkPage,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

function NetworkPage() {
  const { data: overview } = useQuery(overviewQuery());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = overview ?? [];
    if (!search.trim()) return list;
    const s = search.trim().toLowerCase();
    return list.filter(
      (n) =>
        (n.display_name ?? "").toLowerCase().includes(s) ||
        (n.affiliate_code ?? "").toLowerCase().includes(s),
    );
  }, [overview, search]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Multiníveis / Rede de Indicações</h1>
        <p className="text-sm text-white/50">
          Gerentes, afiliados e usuários rastreados por link de indicação.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
        <Search className="h-4 w-4 text-white/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código de indicação..."
          className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-2 px-2 text-xs uppercase tracking-wider text-white/50">
            {filtered.length} pessoa{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="max-h-[520px] space-y-1 overflow-y-auto">
            {filtered.map((n) => (
              <OverviewRow
                key={n.id}
                node={n}
                selected={selectedId === n.id}
                onSelect={() => setSelectedId(n.id)}
              />
            ))}
            {!filtered.length && (
              <div className="p-6 text-center text-sm text-white/40">
                Nenhum gerente ou afiliado encontrado.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          {selectedId ? (
            <NetworkDetail userId={selectedId} />
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-sm text-white/40">
              <Network className="mb-3 h-8 w-8" />
              Selecione uma pessoa para ver a rede.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewRow({
  node,
  selected,
  onSelect,
}: {
  node: ReferralOverviewNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = node.role === "gerente" ? UserCog : Users;
  const tone = node.role === "gerente" ? "text-violet-300" : "text-emerald-300";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition " +
        (selected
          ? "border border-cyan-400/40 bg-cyan-500/10"
          : "border border-transparent hover:bg-white/[0.04]")
      }
    >
      <Icon className={`h-4 w-4 ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-white">
          {node.display_name ?? "(sem nome)"}
        </div>
        <div className="truncate text-xs text-white/40">
          {node.role === "gerente" ? "Gerente" : "Afiliado"} · Código{" "}
          <span className="text-white/70">{node.affiliate_code ?? "—"}</span>
        </div>
      </div>
      <div className="text-right text-xs">
        <div className="text-white/80">{node.directReferralsCount}</div>
        <div className="text-white/40">diretos</div>
      </div>
      <StatusBadge status={node.status} />
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    inactive: "border-white/10 bg-white/5 text-white/60",
    blocked: "border-red-400/30 bg-red-500/10 text-red-300",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${map[status] ?? map.inactive}`}>
      {status}
    </span>
  );
}

function NetworkDetail({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const fetchNet = useServerFn(getReferralNetwork);
  const saveAff = useServerFn(updateAffiliate);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "referral-network", userId],
    queryFn: () => fetchNet({ data: { userId } }),
    staleTime: 30_000,
  });

  const toggleBlock = useMutation({
    mutationFn: saveAff,
    onSuccess: () => {
      toast.success("Conta atualizada");
      qc.invalidateQueries({ queryKey: ["admin", "referral-network", userId] });
      qc.invalidateQueries({ queryKey: ["admin", "referral-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-white/40">Carregando rede...</div>;
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
        {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const isBlocked = data.user.status === "blocked";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">
            {data.user.role}
          </div>
          <div className="mt-0.5 text-lg font-semibold text-white">
            {data.user.display_name ?? "(sem nome)"}
          </div>
          <div className="text-xs text-white/50">
            Código:{" "}
            <span className="font-mono text-white/80">{data.user.affiliate_code ?? "—"}</span>
          </div>
        </div>
        <button
          type="button"
          disabled={toggleBlock.isPending}
          onClick={() =>
            toggleBlock.mutate({
              data: {
                affiliateId: userId,
                status: isBlocked ? "active" : "blocked",
                reason: isBlocked ? "Desbloqueio via rede" : "Bloqueio via rede",
              },
            })
          }
          className={
            "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition " +
            (isBlocked
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              : "border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20")
          }
        >
          {isBlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {isBlocked ? "Desbloquear" : "Bloquear"} conta
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Indicados (total)" value={String(data.totalReferrals)} />
        <Stat label="Comissão pendente" value={formatCurrency(data.pendingCommissions)} />
        <Stat label="Comissão paga" value={formatCurrency(data.paidCommissions)} />
        <Stat label="Saques pagos" value={formatCurrency(data.totalWithdrawals)} />
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-white/50">
          Indicados diretos ({data.directReferrals.length})
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {data.directReferrals.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white">{r.display_name ?? "—"}</td>
                  <td className="px-3 py-2 text-white/70">{r.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-white/50">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
              {!data.directReferrals.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-white/40">
                    Nenhum indicado direto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
