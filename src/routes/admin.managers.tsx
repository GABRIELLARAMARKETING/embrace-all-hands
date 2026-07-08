import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/managers")({
  head: () => ({ meta: [{ title: "managers · Admin Helix" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold capitalize">managers</h1>
        <p className="text-sm text-white/50">Módulo em construção.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
        Conteúdo do módulo <b className="text-white/80">managers</b> será implementado nas próximas etapas.
      </div>
    </div>
  );
}
