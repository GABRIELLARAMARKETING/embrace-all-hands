import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Briefcase, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { Badge } from "@/components/admin/Badge";
import {
  getCommissionSettings,
  updateCommissionSettings,
  resetCommissionSettings,
} from "@/lib/manager.functions";

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
  const qc = useQueryClient();
  const getFn = useServerFn(getCommissionSettings);
  const updateFn = useServerFn(updateCommissionSettings);
  const resetFn = useServerFn(resetCommissionSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["gerente", "commission-settings"],
    queryFn: () => getFn(),
  });

  const [n1, setN1] = useState<string>("");
  const [n2, setN2] = useState<string>("");
  const [n3, setN3] = useState<string>("");

  useEffect(() => {
    if (data) {
      setN1(String(data.level1Percent));
      setN2(String(data.level2Percent));
      setN3(String(data.level3Percent));
    }
  }, [data]);

  const usedValues = useMemo(() => ({
    v1: Number(n1) || 0, v2: Number(n2) || 0, v3: Number(n3) || 0,
  }), [n1, n2, n3]);
  const used = usedValues.v1 + usedValues.v2 + usedValues.v3;
  const budget = data?.totalBudgetPercent ?? 70;
  const overBudget = used > budget;

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({ data: { level1Percent: usedValues.v1, level2Percent: usedValues.v2, level3Percent: usedValues.v3 } }),
    onSuccess: () => {
      toast.success("Ajustes salvos");
      qc.invalidateQueries({ queryKey: ["gerente", "commission-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      toast.success("Padrões restaurados");
      qc.invalidateQueries({ queryKey: ["gerente", "commission-settings"] });
    },
  });

  return (
    <>
      <TopHeader title="Ajustes indicados" subtitle="Configure quanto do seu orçamento cada nível da rede recebe" />
      <div className="space-y-6 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-white">Ajustes de comissão</h2>
        <p className="-mt-4 text-sm text-[color:var(--admin-text-2)]">
          Configure qual % do depósito cada nível da sua rede receberá. O restante do seu orçamento fica para você.
        </p>

        <AdminCard className="border-[color:var(--admin-blue)]/30 bg-[color:var(--admin-blue)]/8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Briefcase className="text-[color:var(--admin-blue)]" size={20} />
              <div>
                <p className="text-sm font-semibold text-white">Seu orçamento total: {budget}%</p>
                <p className="text-xs text-[color:var(--admin-text-2)]">
                  soma de N1+N2+N3 não pode ultrapassar esse valor
                </p>
              </div>
            </div>
            <Badge tone={overBudget ? "red" : "green"}>Usando: {used.toFixed(1)}%</Badge>
          </div>
        </AdminCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LevelCard title="Nível 1" description="% do depósito para indicados diretos." defaultValue={data?.defaults.level1Percent ?? 50} value={n1} onChange={setN1} />
          <LevelCard title="Nível 2" description="% do depósito para segunda camada." defaultValue={data?.defaults.level2Percent ?? 5} value={n2} onChange={setN2} />
          <LevelCard title="Nível 3" description="% do depósito para terceira camada." defaultValue={data?.defaults.level3Percent ?? 1} value={n3} onChange={setN3} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AdminButton onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={overBudget || isLoading} leftIcon={<Save size={16} />}>
            Salvar ajustes
          </AdminButton>
          <AdminButton variant="secondary" onClick={() => resetMut.mutate()} loading={resetMut.isPending} leftIcon={<RotateCcw size={16} />}>
            Restaurar padrões
          </AdminButton>
          {overBudget && <span className="text-sm text-[color:var(--admin-red)]">A soma dos níveis ultrapassa o orçamento.</span>}
        </div>
      </div>
    </>
  );
}

function LevelCard({
  title, description, defaultValue, value, onChange,
}: { title: string; description: string; defaultValue: number; value: string; onChange: (v: string) => void }) {
  return (
    <AdminCard>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">{description}</p>
      <div className="mt-4">
        <AdminInput
          label={`% do depósito`}
          type="number"
          min={0}
          max={100}
          step="0.1"
          suffix="%"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hint={`Padrão: ${defaultValue}%`}
        />
      </div>
    </AdminCard>
  );
}
