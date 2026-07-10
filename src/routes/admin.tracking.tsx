import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Activity, MousePointerClick, UserPlus, Percent, Wallet, Search } from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/admin/Badge";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { formatCurrency } from "@/utils/formatCurrency";
import {
  getTrackingOverview,
  listTrackingEvents,
  type TrackingEvent,
} from "@/lib/tracking.functions";

const overviewQ = () =>
  queryOptions({
    queryKey: ["admin", "tracking", "overview"],
    queryFn: () => getTrackingOverview(),
    staleTime: 15_000,
  });

const eventsQ = (filters: { status: "all" | "converted" | "pending"; code?: string }) =>
  queryOptions({
    queryKey: ["admin", "tracking", "events", filters],
    queryFn: () => listTrackingEvents({ data: { ...filters, limit: 150 } }),
    staleTime: 10_000,
  });

export const Route = createFileRoute("/admin/tracking")({
  head: () => ({
    meta: [
      { title: "Rastreamento de Indicações · Admin Helix" },
      {
        name: "description",
        content: "Tracking em tempo real de links de gerente, afiliado e indicação.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQ()),
  component: TrackingPage,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-white/70">Página não encontrada.</div>,
});

function TrackingPage() {
  const [status, setStatus] = useState<"all" | "converted" | "pending">("all");
  const [codeInput, setCodeInput] = useState("");
  const filters = useMemo(
    () => ({ status, code: codeInput.trim() ? codeInput.trim().toUpperCase() : undefined }),
    [status, codeInput],
  );

  const { data: overview } = useQuery(overviewQ());
  const { data: events = [], isLoading } = useQuery(eventsQ(filters));

  useAdminRealtime({
    table: "referral_clicks",
    invalidateKeys: [
      ["admin", "tracking", "overview"],
      ["admin", "tracking", "events"],
    ],
    toastOnInsert: (row) => {
      const code = String(row.code ?? "");
      const converted = row.converted_user_id != null;
      return converted
        ? `Novo cadastro por indicação (${code})`
        : `Novo clique em link ${code}`;
    },
  });

  useAdminRealtime({
    table: "risk_alerts",
    invalidateKeys: [["admin", "tracking", "overview"]],
    toastOnInsert: (row) => {
      if (row.type === "referral_ip_abuse") return "⚠️ Alerta: múltiplos cadastros do mesmo IP";
      return null;
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-[color:var(--admin-neon)]">
          <Activity size={16} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
            Tracking em tempo real
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white">Rastreamento de Indicações</h1>
        <p className="text-sm text-white/60">
          Cliques em links de gerente/afiliado/indicação, cadastros vinculados e comissões geradas.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cliques (total)"
          value={overview?.totalClicks ?? 0}
          description={`Últimas 24h: ${overview?.clicks24h ?? 0}`}
        />
        <StatCard
          label="Cadastros por link"
          value={overview?.totalConversions ?? 0}
          description={`Últimas 24h: ${overview?.conversions24h ?? 0}`}
        />
        <StatCard
          label="Taxa de conversão"
          value={`${((overview?.conversionRate ?? 0) * 100).toFixed(1)}%`}
          description="Cadastros ÷ cliques"
        />
        <StatCard
          label="Comissões pendentes"
          value={formatCurrency(overview?.commissionsPending ?? 0)}
          description={`Pagas: ${formatCurrency(overview?.commissionsPaid ?? 0)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Comissões disponíveis"
          value={formatCurrency(overview?.commissionsAvailable ?? 0)}
        />
        <StatCard
          label="Comissões canceladas"
          value={formatCurrency(overview?.commissionsCanceled ?? 0)}
        />
        <StatCard
          label="Top indicador"
          value={overview?.topReferrer?.name ?? "—"}
          description={
            overview?.topReferrer
              ? `${overview.topReferrer.conversions} cadastros vinculados`
              : "Sem dados"
          }
        />
        <AdminCard className="flex flex-col justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Como funciona
            </div>
            <p className="mt-2 text-sm text-white/70">
              Compartilhe o link{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">
                /r/CODIGO
              </code>
              . Cada acesso vira um clique, e o cadastro é vinculado automaticamente ao dono do
              código.
            </p>
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">Eventos recentes</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3">
              <Search size={14} className="text-white/40" />
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Filtrar por código"
                className="h-9 w-40 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none"
            >
              <option value="all">Todos</option>
              <option value="converted">Convertidos</option>
              <option value="pending">Só cliques</option>
            </select>
          </div>
        </div>

        <AdminTable<TrackingEvent>
          rows={events}
          getRowKey={(r) => r.id}
          emptyState={
            <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
              {isLoading ? "Carregando eventos…" : "Nenhum evento ainda."}
            </div>
          }
          columns={[
            {
              key: "when",
              header: "Data",
              render: (r) => (
                <span className="whitespace-nowrap text-xs text-white/70">
                  {new Date(r.createdAt).toLocaleString("pt-BR")}
                </span>
              ),
            },
            {
              key: "event",
              header: "Evento",
              render: (r) =>
                r.convertedUserId ? (
                  <Badge tone="success">
                    <UserPlus size={12} /> Cadastro
                  </Badge>
                ) : (
                  <Badge tone="info">
                    <MousePointerClick size={12} /> Clique
                  </Badge>
                ),
            },
            {
              key: "code",
              header: "Código",
              render: (r) => (
                <span className="font-mono text-xs text-white/80">{r.code}</span>
              ),
            },
            {
              key: "owner",
              header: "Dono do link",
              render: (r) => (
                <div className="flex flex-col">
                  <span className="text-white">{r.ownerName ?? "—"}</span>
                  <span className="text-[11px] uppercase tracking-wider text-white/40">
                    {r.ownerType}
                  </span>
                </div>
              ),
            },
            {
              key: "convertedTo",
              header: "Novo usuário",
              render: (r) =>
                r.convertedName ? (
                  <span className="text-white">{r.convertedName}</span>
                ) : (
                  <span className="text-white/40">—</span>
                ),
            },
            {
              key: "utm",
              header: "UTM",
              render: (r) =>
                r.utmSource || r.utmCampaign ? (
                  <div className="text-xs text-white/60">
                    <div>{r.utmSource ?? "—"}</div>
                    <div className="text-white/40">{r.utmCampaign ?? ""}</div>
                  </div>
                ) : (
                  <span className="text-white/30">—</span>
                ),
            },
          ]}
        />
      </AdminCard>

      <AdminCard>
        <div className="flex items-start gap-3 text-sm text-white/60">
          <Percent size={16} className="mt-0.5 shrink-0 text-white/40" />
          <p>
            Comissões são criadas automaticamente pelo backend quando um depósito do indicado é
            aprovado (função <code>process_deposit_commissions</code>). Consulte a página{" "}
            <a href="/admin/commissions" className="text-cyan-300 hover:underline">
              Comissões
            </a>{" "}
            para aprovar, cancelar ou pagar.
          </p>
        </div>
      </AdminCard>
    </div>
  );
}

// keep icon imports used
void Wallet;
void toast;
