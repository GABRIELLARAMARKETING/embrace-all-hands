import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Briefcase, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { Badge } from "@/components/admin/Badge";
import { useAdminStore } from "@/store/useAdminStore";

export const Route = createFileRoute("/gerente/ajustes-indicados")({
  head: () => ({
    meta: [
      { title: "Ajustes indicados · Gerente Helix" },
      {
        name: "description",
        content: "Configure quanto do seu orçamento cada nível da rede recebe.",
      },
    ],
  }),
  component: AjustesIndicadosPage,
});

function AjustesIndicadosPage() {
  const settings = useAdminStore((s) => s.commissionSettings);
  const update = useAdminStore((s) => s.updateCommissionSettings);
  const reset = useAdminStore((s) => s.resetCommissionSettings);

  const [n1, setN1] = useState<string>(settings.n1Percent?.toString() ?? "");
  const [n2, setN2] = useState<string>(settings.n2Percent?.toString() ?? "");
  const [n3, setN3] = useState<string>(settings.n3Percent?.toString() ?? "");

  const usedValues = useMemo(() => {
    const v1 = n1.trim() === "" ? settings.defaultN1 : Number(n1);
    const v2 = n2.trim() === "" ? settings.defaultN2 : Number(n2);
    const v3 = n3.trim() === "" ? settings.defaultN3 : Number(n3);
    return {
      v1: Number.isFinite(v1) ? v1 : 0,
      v2: Number.isFinite(v2) ? v2 : 0,
      v3: Number.isFinite(v3) ? v3 : 0,
    };
  }, [n1, n2, n3, settings]);

  const used = usedValues.v1 + usedValues.v2 + usedValues.v3;
  const overBudget = used > settings.budgetPercent;

  const save = () => {
    if (overBudget) {
      toast.error(
        `Soma ${used.toFixed(1)}% excede o orçamento de ${settings.budgetPercent}%`,
      );
      return;
    }
    update({
      n1Percent: n1.trim() === "" ? null : Number(n1),
      n2Percent: n2.trim() === "" ? null : Number(n2),
      n3Percent: n3.trim() === "" ? null : Number(n3),
    });
    toast.success("Ajustes salvos");
  };

  const restore = () => {
    setN1("");
    setN2("");
    setN3("");
    reset();
    toast.success("Padrões restaurados");
  };

  return (
    <>
      <TopHeader
        title="Ajustes indicados"
        subtitle="Configure quanto do seu orçamento cada nível da rede recebe"
      />
      <div className="space-y-6 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white">Ajustes de comissão</h2>
        <p className="-mt-4 text-sm text-[color:var(--admin-text-2)]">
          Configure qual % do depósito cada nível da sua rede receberá. O restante após pagar os
          afiliados fica para você. Ex.: você tem orçamento de 80% e configura N1 em 50% → o
          afiliado N1 recebe exatamente 50% do depósito, e você fica com os 30% restantes (80% -
          50%).
        </p>

        <AdminCard className="border-[color:var(--admin-blue)]/30 bg-[color:var(--admin-blue)]/8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Briefcase className="text-[color:var(--admin-blue)]" size={20} />
              <div>
                <p className="text-sm font-semibold text-white">
                  Seu orçamento total: {settings.budgetPercent}%
                </p>
                <p className="text-xs text-[color:var(--admin-text-2)]">
                  soma de N1+N2+N3 não pode ultrapassar esse valor
                </p>
              </div>
            </div>
            <Badge tone={overBudget ? "red" : "green"}>Usando: {used.toFixed(1)}%</Badge>
          </div>
        </AdminCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LevelCard
            title="Nível 1 — Indicados diretos"
            description="% real do depósito que vai para quem indicou diretamente o jogador (N1). Ex.: N1 = 50% → afiliado N1 recebe exatamente 50% do valor depositado."
            defaultValue={settings.defaultN1}
            value={n1}
            onChange={setN1}
          />
          <LevelCard
            title="Nível 2 — Segunda camada"
            description="% real do depósito que vai para o afiliado de nível 2 (quem indicou o N1). Ex.: N2 = 10% → afiliado N2 recebe exatamente 10% do valor depositado."
            defaultValue={settings.defaultN2}
            value={n2}
            onChange={setN2}
          />
          <LevelCard
            title="Nível 3 — Terceira camada"
            description="% real do depósito que vai para o afiliado de nível 3. O restante do seu orçamento (após N1 + N2 + N3) fica para você."
            defaultValue={settings.defaultN3}
            value={n3}
            onChange={setN3}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AdminButton onClick={save} leftIcon={<Save size={16} />}>
            Salvar ajustes
          </AdminButton>
          <AdminButton variant="secondary" onClick={restore} leftIcon={<RotateCcw size={16} />}>
            Restaurar padrões
          </AdminButton>
          {overBudget && (
            <span className="text-sm text-[color:var(--admin-red)]">
              A soma dos níveis ultrapassa o orçamento.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function LevelCard({
  title,
  description,
  defaultValue,
  value,
  onChange,
}: {
  title: string;
  description: string;
  defaultValue: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <AdminCard>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">{description}</p>
      <div className="mt-4">
        <AdminInput
          label={`% do depósito para ${title.split(" ")[1]}:`}
          placeholder="Padrão"
          type="number"
          min={0}
          max={100}
          step="0.1"
          suffix="%"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hint={`Padrão do sistema: ${defaultValue}%`}
        />
      </div>
    </AdminCard>
  );
}
