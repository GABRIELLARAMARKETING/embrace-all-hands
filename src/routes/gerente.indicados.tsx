import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { TopHeader } from "@/components/admin/TopHeader";
import { StatCard } from "@/components/admin/StatCard";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminTable } from "@/components/admin/AdminTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { Badge } from "@/components/admin/Badge";
import { useAdminStore } from "@/store/useAdminStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import type { ReferralLevel, ReferralUser } from "@/data/mockAdminData";

export const Route = createFileRoute("/gerente/indicados")({
  head: () => ({
    meta: [
      { title: "Indicados · Gerente Helix" },
      { name: "description", content: "Usuários da sua rede por nível." },
    ],
  }),
  component: IndicadosPage,
});

const levelMeta: Record<
  ReferralLevel,
  { title: string; badge: string; description: string }
> = {
  1: {
    title: "Nível 1 — Indicados diretos",
    badge: "50% (padrão)",
    description: "indicados diretos — 50% (padrão)",
  },
  2: {
    title: "Nível 2",
    badge: "5% (padrão)",
    description: "indicados dos indicados — 5% (padrão)",
  },
  3: {
    title: "Nível 3",
    badge: "1% (padrão)",
    description: "terceira camada — 1% (padrão)",
  },
};

function IndicadosPage() {
  const referrals = useAdminStore((s) => s.referrals);
  const refresh = useAdminStore((s) => s.refreshMetrics);

  return (
    <>
      <TopHeader
        title="Indicados"
        subtitle="Usuários da sua rede por nível (1, 2 e 3)"
      />
      <div className="space-y-6 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total recebido de comissão"
            value={formatCurrency(0)}
            description="sua rede (todos os níveis)"
          />
          <StatCard
            label="Comissão nível 1"
            value={formatCurrency(0)}
            description="indicados diretos — 50% (padrão)"
          />
          <StatCard
            label="Comissão nível 2"
            value={formatCurrency(0)}
            description="indicados dos indicados — 5% (padrão)"
          />
          <StatCard
            label="Comissão nível 3"
            value={formatCurrency(0)}
            description="terceira camada — 1% (padrão)"
          />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Indicados</h2>
          <AdminButton
            variant="secondary"
            leftIcon={<RefreshCw size={16} />}
            onClick={() => {
              refresh();
              toast.success("Lista atualizada");
            }}
          >
            Atualizar
          </AdminButton>
        </div>
        <p className="-mt-4 text-sm text-[color:var(--admin-text-2)]">
          Usuários que entraram pela sua rede de indicação (nível 1 = diretos, nível 2 e 3 =
          indicados dos seus indicados).
        </p>

        {([1, 2, 3] as ReferralLevel[]).map((level) => (
          <LevelBlock key={level} level={level} referrals={referrals} />
        ))}
      </div>
    </>
  );
}

function LevelBlock({
  level,
  referrals,
}: {
  level: ReferralLevel;
  referrals: ReferralUser[];
}) {
  const [query, setQuery] = useState("");
  const meta = levelMeta[level];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return referrals.filter((r) => {
      if (r.level !== level) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      );
    });
  }, [referrals, level, query]);

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
            placeholder="Buscar nome, e-mail ou telefone..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[color:var(--admin-text-3)]"
            aria-label={`Buscar em ${meta.title}`}
          />
        </div>
        <span className="text-sm text-[color:var(--admin-text-3)]">
          {filtered.length} usuários
        </span>
      </div>

      <AdminTable
        emptyState={<EmptyState message="Nenhum indicado" />}
        columns={[
          { key: "n", header: "#", render: (_r, i) => i + 1, width: "48px" },
          { key: "name", header: "Nome", render: (r) => <span className="text-white">{r.name}</span> },
          { key: "email", header: "E-mail", render: (r) => r.email },
          { key: "phone", header: "Telefone", render: (r) => r.phone },
          {
            key: "createdAt",
            header: "Data cadastro",
            render: (r) => formatDate(r.createdAt),
          },
          {
            key: "total",
            header: "Total Depositado",
            render: (r) => formatCurrency(r.totalDeposited),
          },
          {
            key: "has",
            header: "Com depósito",
            render: (r) =>
              r.hasDeposit ? (
                <Badge tone="green">Sim</Badge>
              ) : (
                <Badge tone="neutral">Não</Badge>
              ),
          },
          {
            key: "actions",
            header: "Ações",
            render: () => (
              <AdminButton size="sm" variant="ghost">
                Ver
              </AdminButton>
            ),
          },
        ]}
        rows={filtered}
        getRowKey={(r) => r.id}
      />
    </AdminCard>
  );
}
