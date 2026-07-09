import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_HELIX_CONFIG,
  HELIX_DIFFICULTIES,
  HELIX_DIFFICULTY_LABELS,
  HELIX_DIFFICULTY_PRESETS,
  HELIX_SETTINGS_LABELS,
  HELIX_SETTINGS_RANGES,
  clampSettings,
  settingsForDifficulty,
  type HelixDifficulty,
  type HelixSettings,
} from "@/game/config/difficulty";
import { getHelixDifficulty, setHelixDifficulty } from "@/lib/helix-difficulty.functions";

const helixQuery = () =>
  queryOptions({
    queryKey: ["admin", "helix-difficulty"],
    queryFn: () => getHelixDifficulty(),
    staleTime: 15_000,
  });

export const Route = createFileRoute("/admin/helix")({
  head: () => ({ meta: [{ title: "Configurações do Jogo Helix · Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(helixQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
});

function Page() {
  const { data } = useQuery(helixQuery());
  const qc = useQueryClient();
  const saveFn = useServerFn(setHelixDifficulty);

  const [difficulty, setDifficulty] = useState<HelixDifficulty>(data?.difficulty ?? "normal");
  const [settings, setSettings] = useState<HelixSettings>(data?.settings ?? DEFAULT_HELIX_CONFIG.settings);

  useEffect(() => {
    if (data) {
      setDifficulty(data.difficulty);
      setSettings(data.settings);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: saveFn,
    onSuccess: (payload) => {
      toast.success("Configuração salva");
      qc.setQueryData(["admin", "helix-difficulty"], payload);
      qc.invalidateQueries({ queryKey: ["helix", "difficulty"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function selectDifficulty(next: HelixDifficulty) {
    setDifficulty(next);
    if (next !== "custom") setSettings(settingsForDifficulty(next));
  }

  function updateField(k: keyof HelixSettings, raw: string) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    setSettings((s) => ({ ...s, [k]: v }));
  }

  function restoreDefault() {
    setDifficulty("normal");
    setSettings(HELIX_DIFFICULTY_PRESETS.normal);
  }

  function save() {
    const clean = clampSettings(settings);
    mutation.mutate({
      data: { difficulty, settings: difficulty === "custom" ? clean : settingsForDifficulty(difficulty) },
    });
  }

  const isCustom = difficulty === "custom";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Configurações do Jogo Helix</h1>
        <p className="mt-1 text-sm text-white/60">
          Ajuste a dificuldade aplicada em tempo real a todos os jogadores.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <label className="mb-2 block text-sm font-medium text-white/80">Dificuldade do Jogo</label>
        <div className="flex flex-wrap gap-2">
          {HELIX_DIFFICULTIES.map((d) => {
            const active = d === difficulty;
            return (
              <button
                key={d}
                type="button"
                onClick={() => selectDifficulty(d)}
                className={
                  "rounded-lg border px-4 py-2 text-sm transition " +
                  (active
                    ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]")
                }
              >
                {HELIX_DIFFICULTY_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium text-white/80">
            Parâmetros {isCustom ? "(edite livremente)" : "(prévia)"}
          </div>
          {!isCustom && (
            <div className="text-xs text-white/50">
              Alterne para <span className="text-cyan-300">Personalizado</span> para editar.
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(HELIX_SETTINGS_LABELS) as (keyof HelixSettings)[]).map((k) => {
            const [min, max] = HELIX_SETTINGS_RANGES[k];
            return (
              <div key={k} className="rounded-lg border border-white/5 bg-black/20 p-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <label className="text-sm text-white/80">{HELIX_SETTINGS_LABELS[k]}</label>
                  <span className="text-xs text-white/40">
                    {min} – {max}
                  </span>
                </div>
                <input
                  type="number"
                  step={0.05}
                  min={min}
                  max={max}
                  disabled={!isCustom}
                  value={settings[k]}
                  onChange={(e) => updateField(k, e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50 disabled:opacity-60"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={mutation.isPending}
          className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-5 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-60"
        >
          {mutation.isPending ? "Salvando..." : "Salvar Configuração"}
        </button>
        <button
          type="button"
          onClick={restoreDefault}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
        >
          Restaurar padrão
        </button>
        <div className="text-xs text-white/50">
          Dificuldade ativa no banco:{" "}
          <span className="text-white/80">{HELIX_DIFFICULTY_LABELS[data?.difficulty ?? "normal"]}</span>
        </div>
      </div>
    </div>
  );
}
