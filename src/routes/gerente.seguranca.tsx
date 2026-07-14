import { createFileRoute } from "@tanstack/react-router";
import { AdminCard } from "@/components/admin/AdminCard";
import { Badge } from "@/components/admin/Badge";
import { SectionTitle } from "@/components/admin/SectionTitle";
import { ShieldCheck, AlertTriangle, Info, XCircle } from "lucide-react";

export const Route = createFileRoute("/gerente/seguranca")({
  component: SecurityDashboard,
});

type Severity = "critical" | "high" | "warn" | "info";

interface Finding {
  scanner: string;
  id: string;
  name: string;
  description: string;
  severity: Severity;
  link?: string;
  status: "open" | "fixed" | "accepted";
}

// Snapshot of latest Lovable security scan (Aikido + Supabase scanners).
// Full live results live in the Lovable dashboard → Security tab.
const FINDINGS: Finding[] = [
  {
    scanner: "supabase",
    id: "SUPA_auth_leaked_password_protection",
    name: "Leaked Password Protection",
    description:
      "HIBP check for compromised passwords on signup/reset. Enabled via configure_auth.",
    severity: "warn",
    link: "https://docs.lovable.dev/features/security#leaked-password-protection",
    status: "fixed",
  },
  {
    scanner: "supabase_lov",
    id: "affiliate_withdrawals_realtime_exposes_pii_fields",
    name: "Realtime on affiliate_withdrawals (PIX/IP)",
    description:
      "Table is published to Realtime and contains pix_key/request_ip/admin_notes. RLS scopes SELECT to owner/admin — adequately protected.",
    severity: "warn",
    status: "accepted",
  },
  {
    scanner: "supabase_lov",
    id: "demo_accounts_no_insert_ownership_check_missing_manager_id_pattern",
    name: "demo_accounts manager ownership",
    description:
      "Policies rely on manager_id ownership checks; correctly scoped. Documented as intentional.",
    severity: "warn",
    status: "accepted",
  },
  {
    scanner: "supabase_lov",
    id: "game_sessions_no_delete_policy",
    name: "game_sessions has no DELETE policy",
    description:
      "No DELETE policy means clients cannot delete session rows — restrictive by design, not exploitable.",
    severity: "warn",
    status: "accepted",
  },
];

const sevOrder: Record<Severity, number> = { critical: 0, high: 1, warn: 2, info: 3 };

function severityBadge(sev: Severity) {
  const map: Record<Severity, { label: string; tone: "danger" | "warn" | "info" | "neutral"; icon: React.ReactNode }> = {
    critical: { label: "Critical", tone: "danger", icon: <XCircle size={12} /> },
    high: { label: "High", tone: "danger", icon: <AlertTriangle size={12} /> },
    warn: { label: "Warn", tone: "warn", icon: <AlertTriangle size={12} /> },
    info: { label: "Info", tone: "info", icon: <Info size={12} /> },
  };
  const m = map[sev];
  return (
    <Badge tone={m.tone}>
      <span className="inline-flex items-center gap-1">
        {m.icon}
        {m.label}
      </span>
    </Badge>
  );
}

function statusBadge(status: Finding["status"]) {
  if (status === "fixed") return <Badge tone="success">Fixed</Badge>;
  if (status === "accepted") return <Badge tone="neutral">Accepted risk</Badge>;
  return <Badge tone="warn">Open</Badge>;
}

function SecurityDashboard() {
  const sorted = [...FINDINGS].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const openCount = sorted.filter((f) => f.status === "open").length;
  const fixedCount = sorted.filter((f) => f.status === "fixed").length;
  const acceptedCount = sorted.filter((f) => f.status === "accepted").length;

  return (
    <div className="space-y-6 p-6">
      <SectionTitle
        title="Segurança"
        subtitle="Últimos achados dos scanners de segurança do projeto."
        icon={<ShieldCheck size={20} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminCard>
          <div className="p-4">
            <p className="text-xs uppercase tracking-wider text-[color:var(--admin-text-3)]">Abertos</p>
            <p className="mt-1 text-2xl font-bold text-white">{openCount}</p>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="p-4">
            <p className="text-xs uppercase tracking-wider text-[color:var(--admin-text-3)]">Corrigidos</p>
            <p className="mt-1 text-2xl font-bold text-[color:var(--admin-neon)]">{fixedCount}</p>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="p-4">
            <p className="text-xs uppercase tracking-wider text-[color:var(--admin-text-3)]">Risco aceito</p>
            <p className="mt-1 text-2xl font-bold text-white">{acceptedCount}</p>
          </div>
        </AdminCard>
      </div>

      <AdminCard>
        <div className="divide-y divide-[color:var(--admin-line)]">
          {sorted.map((f) => (
            <div key={f.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {severityBadge(f.severity)}
                  {statusBadge(f.status)}
                  <span className="text-xs text-[color:var(--admin-text-3)]">{f.scanner}</span>
                </div>
                <p className="mt-2 font-semibold text-white">{f.name}</p>
                <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">{f.description}</p>
                <p className="mt-1 font-mono text-[11px] text-[color:var(--admin-text-3)]">{f.id}</p>
              </div>
              {f.link && (
                <a
                  href={f.link}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-sm text-[color:var(--admin-neon)] hover:underline"
                >
                  Docs ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </AdminCard>

      <p className="text-xs text-[color:var(--admin-text-3)]">
        Snapshot atualizado manualmente a partir do scanner Lovable. Achados em tempo real ficam na
        aba Security do dashboard Lovable.
      </p>
    </div>
  );
}
