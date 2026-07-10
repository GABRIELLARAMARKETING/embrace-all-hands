import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/kyc")({
  head: () => ({ meta: [{ title: "KYC · Admin Helix" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Verificação KYC</h1>
        <p className="text-sm text-white/50">Validação de identidade dos afiliados e usuários.</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/50">
        Nenhuma solicitação KYC pendente no momento.
      </div>
    </div>
  );
}
