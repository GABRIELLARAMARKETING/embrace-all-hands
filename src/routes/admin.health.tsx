import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { noInput } from "@/lib/validation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(noInput)
  .handler(async ({ context }) => {
    const t0 = Date.now();
    const { error } = await context.supabase.from("audit_events").select("id", { head: true, count: "exact" }).limit(1);
    const dbMs = Date.now() - t0;
    return { dbOk: !error, dbMs, ts: new Date().toISOString() };
  });

const healthQuery = queryOptions({
  queryKey: ["admin", "health"],
  queryFn: () => getHealth(),
  refetchInterval: 15_000,
});

export const Route = createFileRoute("/admin/health")({
  head: () => ({ meta: [{ title: "Saúde · Admin Helix" }] }),
  component: Page,
});

function Page() {
  const { data } = useQuery(healthQuery);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Saúde do Sistema</h1>
        <p className="text-sm text-white/50">Verificação em tempo real dos serviços.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Kpi label="Banco de dados" value={data?.dbOk ? "Online" : "—"} tone={data?.dbOk ? "emerald" : "slate"} />
        <Kpi label="Latência DB" value={data ? `${data.dbMs} ms` : "—"} tone="cyan" />
        <Kpi label="Última checagem" value={data ? new Date(data.ts).toLocaleTimeString("pt-BR") : "—"} tone="slate" />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "emerald" | "cyan" | "slate" }) {
  const t: Record<string, string> = {
    emerald: "border-emerald-400/20 text-emerald-300",
    cyan: "border-cyan-400/20 text-cyan-300",
    slate: "border-white/10 text-white/70",
  };
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-4 ${t[tone]}`}>
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
