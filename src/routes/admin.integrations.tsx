import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrações · Admin Helix" }] }),
  component: Page,
});

function Page() {
  const items = [
    { name: "Diggion Pagamentos", status: "Conectado", tone: "emerald" },
    { name: "Lovable Cloud", status: "Ativo", tone: "emerald" },
    { name: "Webhook de Depósitos", status: "Monitorado", tone: "cyan" },
  ] as const;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-white/50">Status dos provedores conectados.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <div key={i.name} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-sm font-medium">{i.name}</div>
            <div className={`mt-1 text-xs ${i.tone === "emerald" ? "text-emerald-300" : "text-cyan-300"}`}>{i.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
