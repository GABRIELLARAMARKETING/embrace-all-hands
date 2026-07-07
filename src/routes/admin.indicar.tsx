import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { CopyButton } from "@/components/admin/CopyButton";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { useAdminStore } from "@/store/useAdminStore";

export const Route = createFileRoute("/admin/indicar")({
  head: () => ({
    meta: [
      { title: "Indicar · Gerente Helix" },
      { name: "description", content: "Seu link de indicação para compartilhar." },
    ],
  }),
  component: IndicarPage,
});

function IndicarPage() {
  const link = useAdminStore((s) => s.referralLink);
  const influencer = useAdminStore((s) => s.influencerMode);
  const setInfluencer = useAdminStore((s) => s.setInfluencerMode);
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <>
      <TopHeader title="Indicar" subtitle="Seu link de indicação para compartilhar" />
      <div className="space-y-4 p-4 sm:p-8">
        <AdminCard>
          <h2 className="text-lg font-semibold text-white">Indicar Amigos</h2>

          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--admin-text-3)]">
            Seu link exclusivo
          </p>
          <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">
            Compartilhe este link. Quem se cadastrar por ele será seu indicado e você pode ganhar
            comissão no primeiro depósito.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] px-3 h-11">
              <input
                readOnly
                value={link}
                className="w-full bg-transparent text-sm text-white outline-none"
                aria-label="Link de indicação"
              />
            </div>
            <CopyButton value={link} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <MiniStat value={0} label="Indicados" />
            <MiniStat value={0} label="Com depósito" />
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Influencer via Link</h2>
              <p className="mt-2 max-w-xl text-sm text-[color:var(--admin-text-2)]">
                Novos usuários cadastrados pelo seu link serão marcados como influencer. A
                dificuldade do jogo não é alterada.
              </p>
            </div>
            <ToggleSwitch
              checked={influencer}
              color="green"
              onChange={(v) => {
                setInfluencer(v);
                setFeedback(v ? "Ativado" : "Desativado");
                setTimeout(() => setFeedback(null), 1500);
              }}
            />
          </div>
          {feedback && (
            <p className="mt-3 text-xs text-[color:var(--admin-neon)]">Modo {feedback}</p>
          )}
        </AdminCard>
      </div>
    </>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--admin-text-3)]">{label}</p>
    </div>
  );
}
