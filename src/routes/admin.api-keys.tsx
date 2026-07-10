import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/api-keys")({
  head: () => ({ meta: [{ title: "API Keys · Admin Helix" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Chaves de API</h1>
        <p className="text-sm text-white/50">Segredos e tokens usados por integrações externas.</p>
      </div>
      <div className="rounded-xl border border-yellow-400/20 bg-yellow-500/5 p-4 text-sm text-yellow-200">
        As chaves sensíveis são gerenciadas em segredos do backend e nunca expostas no painel.
      </div>
    </div>
  );
}
