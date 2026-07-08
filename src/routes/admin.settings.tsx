import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listPlatformSettings, upsertPlatformSetting } from "@/lib/admin-extras.functions";
import { toast } from "sonner";

const settingsQuery = () =>
  queryOptions({
    queryKey: ["admin", "platform-settings"],
    queryFn: () => listPlatformSettings(),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Configurações · Admin Helix" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery()),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error.message}</div>
  ),
});

function Page() {
  const { data: rows = [] } = useQuery(settingsQuery());
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertPlatformSetting);
  const upsert = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["admin", "platform-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">Admin</div>
        <h1 className="mt-1 text-2xl font-semibold">Configurações da Plataforma</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newKey.trim()) return;
          let parsed: unknown = newValue;
          try { parsed = JSON.parse(newValue); } catch { /* keep as string */ }
          upsert.mutate({ data: { key: newKey.trim(), value: parsed } });
          setNewKey(""); setNewValue("");
        }}
        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
      >
        <div className="mb-3 text-sm font-medium">Nova configuração</div>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="chave (ex: min_withdrawal)"
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder='valor (string, número ou JSON)'
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-cyan-400/50" />
          <button className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200" disabled={upsert.isPending}>
            Salvar
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase text-white/50">
            <tr>
              <th className="px-4 py-3">Chave</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Crítica</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Nenhuma configuração ainda.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-cyan-200">{r.key}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{JSON.stringify(r.value)}</td>
                  <td className="px-4 py-3 text-white/60">{r.type}</td>
                  <td className="px-4 py-3 text-white/50">{r.description ?? "—"}</td>
                  <td className="px-4 py-3">{r.is_critical ? "⚠️" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
