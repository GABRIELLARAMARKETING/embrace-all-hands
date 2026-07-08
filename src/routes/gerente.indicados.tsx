import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopHeader } from "@/components/admin/TopHeader";
import { StatCard } from "@/components/admin/StatCard";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { Badge } from "@/components/admin/Badge";
import { listManagerReferrals } from "@/lib/manager.functions";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export const Route = createFileRoute("/gerente/indicados")({
  head: () => ({
    meta: [
      { title: "Indicados · Gerente Helix" },
      { name: "description", content: "Usuários da sua rede por nível." },
    ],
  }),
  component: IndicadosPage,
});

type Level = 1 | 2 | 3;
type Row = {
  id: string;
  name: string;
  status: string;
  level: number;
  totalDeposited: number;
  totalCommissionGenerated: number;
  firstDepositAt: string | null;
  createdAt: string;
};

const levelMeta: Record<Level, { title: string; badge: string }> = {
  1: { title: "Nível 1 — Indicados diretos", badge: "N1" },
  2: { title: "Nível 2", badge: "N2" },
  3: { title: "Nível 3", badge: "N3" },
};

function IndicadosPage() {
  const fn = useServerFn(listManagerReferrals);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["gerente", "referrals"],
    queryFn: () => fn({ data: {} }),
    staleTime: 30_000,
  });

  const summary = data?.summary;

  return (
    <>
      <TopHeader title="Indicados" subtitle="Usuários da sua rede por nível (1, 2 e 3)" />
      <div className="space-y-6 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total recebido de comissão"
            value={isLoading ? "…" : formatCurrency(summary?.totalCommissionReceived ?? 0)}
            description="sua rede (todos os níveis)"
          />
          <StatCard label="Comissão nível 1" value={isLoading ? "…" : formatCurrency(summary?.level1Commission ?? 0)} description="indicados diretos" />
          <StatCard label="Comissão nível 2" value={isLoading ? "…" : formatCurrency(summary?.level2Commission ?? 0)} description="segunda camada" />
          <StatCard label="Comissão nível 3" value={isLoading ? "…" : formatCurrency(summary?.level3Commission ?? 0)} description="terceira camada" />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Indicados</h2>
          <AdminButton
            variant="secondary"
            leftIcon={<RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />}
            onClick={() => refetch()}
          >
            Atualizar
          </AdminButton>
        </div>

        {([1, 2, 3] as Level[]).map((level) => (
          <LevelBlock
            key={level}
            level={level}
            rows={(data?.[`level${level}` as "level1" | "level2" | "level3"] ?? []) as Row[]}
          />
        ))}
      </div>
    </>
  );
}

function LevelBlock({ level, rows }: { level: Level; rows: Row[] }) {
  const [query, setQuery] = useState("");
  const meta = levelMeta[level];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <AdminCard>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold text-white">{meta.title}</h3>
        <Badge tone="neutral">{filtered.length}</Badge>
        <Badge tone="green">{meta.badge}</Badge>
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-11 items-center rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] px-3">
          <Search size={16} className="mr-2 text-[color:var(--admin-text-3)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 80))}
            placeholder="Buscar nome..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[color:var(--admin-text-3)]"
          />
        </div>
        <span className="text-sm text-[color:var(--admin-text-3)]">{filtered.length} usuários</span>
      </div>

      <AdminTable
        emptyState={<EmptyState message="Nenhum indicado" />}
        columns={[
          { key: "n", header: "#", render: (_r, i) => i + 1, width: "48px" },
          { key: "name", header: "Nome", render: (r) => <span className="text-white">{r.name}</span> },
          { key: "created", header: "Cadastro", render: (r) => formatDate(r.createdAt) },
          { key: "dep", header: "Depositado", render: (r) => formatCurrency(r.totalDeposited) },
          { key: "com", header: "Comissão", render: (r) => formatCurrency(r.totalCommissionGenerated) },
          {
            key: "has",
            header: "Depositou",
            render: (r) => (r.totalDeposited > 0 ? <Badge tone="green">Sim</Badge> : <Badge tone="neutral">Não</Badge>),
          },
        ]}
        rows={filtered}
        getRowKey={(r) => r.id}
      />
    </AdminCard>
  );
}
