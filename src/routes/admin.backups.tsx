import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/backups")({
  head: () => ({ meta: [{ title: "Backups · Admin Helix" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Backups & Exportações</h1>
        <p className="text-sm text-white/50">Snapshots automáticos gerenciados pela Lovable Cloud.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-sm text-white/70">
          O banco é replicado continuamente. Exportações CSV estão disponíveis em cada seção (Financeiro, Saques, Logs).
        </div>
      </div>
    </div>
  );
}
