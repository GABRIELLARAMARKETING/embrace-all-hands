import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  searchImpersonationTargets,
  startImpersonation,
  stopImpersonation,
  getActiveImpersonation,
  listImpersonationHistory,
  type ImpersonationTarget,
} from "@/lib/impersonation.functions";
import { formatDate } from "@/utils/formatDate";

export const Route = createFileRoute("/admin/impersonation")({
  head: () => ({ meta: [{ title: "Impersonação · Admin Helix" }] }),
  component: Page,
  errorComponent: ({ error }) => (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="text-white/60">Não encontrado.</div>,
});

function Page() {
  const qc = useQueryClient();
  const search = useServerFn(searchImpersonationTargets);
  const start = useServerFn(startImpersonation);
  const stop = useServerFn(stopImpersonation);
  const getActive = useServerFn(getActiveImpersonation);
  const listHistory = useServerFn(listImpersonationHistory);

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "user" | "gerente" | "admin">("all");
  const [target, setTarget] = useState<ImpersonationTarget | null>(null);

  const active = useQuery({
    queryKey: ["admin", "impersonation", "active"],
    queryFn: () => getActive(),
    refetchInterval: 15_000,
  });

  const results = useQuery({
    queryKey: ["admin", "impersonation", "search", q, role],
    queryFn: () => search({ data: { query: q || undefined, role } }),
  });

  const history = useQuery({
    queryKey: ["admin", "impersonation", "history"],
    queryFn: () => listHistory({ data: { limit: 30 } }),
  });

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["admin", "impersonation"] });

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-cyan-300/70">
          Admin · Segurança
        </div>
        <h1 className="mt-1 text-2xl font-semibold">Impersonação segura</h1>
        <p className="text-sm text-white/50">
          Acesse temporariamente a visão de um usuário, gerente ou afiliado — apenas super admin,
          com motivo obrigatório e auditoria completa.
        </p>
      </header>

      {active.data && (
        <ImpersonationBanner
          session={active.data}
          onStop={async () => {
            await stop({ data: { sessionId: active.data!.id, reason: "manual_stop" } });
            refresh();
          }}
        />
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-[10px] uppercase tracking-widest text-white/40">
            Buscar
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, código de afiliado ou UUID"
              className="mt-1 w-64 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm normal-case tracking-normal text-white focus:border-cyan-400/50 focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-[10px] uppercase tracking-widest text-white/40">
            Papel
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as never)}
              className="mt-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm normal-case tracking-normal text-white focus:border-cyan-400/50 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="user">Usuário</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Papel</th>
                <th className="px-3 py-2 text-left">Demo</th>
                <th className="px-3 py-2 text-left">Criado</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(results.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-white/40">
                    {results.isFetching ? "Buscando…" : "Nenhum alvo elegível."}
                  </td>
                </tr>
              )}
              {(results.data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-3 py-2">
                    <div className="text-white/90">
                      {u.display_name ?? "(sem nome)"}
                    </div>
                    <div className="font-mono text-[11px] text-white/40">
                      {u.id}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-white/70">{u.role}</td>
                  <td className="px-3 py-2 text-white/60">{u.is_demo ? "sim" : "não"}</td>
                  <td className="px-3 py-2 text-white/60">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setTarget(u)}
                      disabled={!!active.data}
                      className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                      title={active.data ? "Encerre a sessão ativa antes" : ""}
                    >
                      Entrar como
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <HistorySection
        rows={history.data ?? []}
        onStop={async (id) => {
          await stop({ data: { sessionId: id, reason: "manual_stop_history" } });
          refresh();
        }}
      />

      {target && (
        <StartModal
          target={target}
          onClose={() => setTarget(null)}
          onConfirm={async (payload) => {
            await start({
              data: {
                targetUserId: target.id,
                reason: payload.reason,
                confirmationText: payload.confirmation,
                mode: payload.mode,
                ttlMinutes: 15,
              },
            });
            setTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ImpersonationBanner({
  session,
  onStop,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getActiveImpersonation>>>;
  onStop: () => Promise<void>;
}) {
  const remaining = useMemo(() => {
    const ms = new Date(session.expires_at).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  }, [session.expires_at]);
  return (
    <div className="sticky top-2 z-40 rounded-xl border border-amber-400/40 bg-amber-500/15 p-3 text-amber-100 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-amber-200/80">
            Modo impersonação ativo
          </div>
          <div className="mt-1 text-sm font-semibold">
            Acessando como {session.target_display_name ?? session.target_user_id}
            {session.target_role ? ` · ${session.target_role}` : ""}
          </div>
          <div className="text-xs text-amber-100/70">
            Motivo: {session.reason} · Modo: {session.mode} · Suas ações estão sendo auditadas.
          </div>
          <div className="text-[11px] text-amber-100/60">
            Expira em {Math.floor(remaining / 60)}m {remaining % 60}s ({formatDate(session.expires_at)})
          </div>
        </div>
        <button
          onClick={onStop}
          className="rounded-md border border-amber-300/50 bg-amber-500/25 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/40"
        >
          Sair da impersonação
        </button>
      </div>
    </div>
  );
}

function StartModal({
  target,
  onClose,
  onConfirm,
}: {
  target: ImpersonationTarget;
  onClose: () => void;
  onConfirm: (p: {
    reason: string;
    confirmation: string;
    mode: "read_only" | "support_limited";
  }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mode, setMode] = useState<"read_only" | "support_limited">("read_only");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    reason.trim().length >= 5 &&
    confirmation.trim().toUpperCase() === "ENTRAR COMO USUÁRIO" &&
    !submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Confirmar impersonação</h2>
            <p className="text-xs text-white/50">
              Alvo: {target.display_name ?? "(sem nome)"} · {target.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/70 hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs uppercase tracking-widest text-white/40">
            Motivo (obrigatório, mín. 5 caracteres)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex.: Suporte ao usuário — investigação de saldo"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm normal-case tracking-normal text-white focus:border-cyan-400/50 focus:outline-none"
            />
          </label>

          <label className="block text-xs uppercase tracking-widest text-white/40">
            Modo
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as never)}
              className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm normal-case tracking-normal text-white focus:border-cyan-400/50 focus:outline-none"
            >
              <option value="read_only">Somente leitura (recomendado)</option>
              <option value="support_limited">Suporte limitado (ações seguras)</option>
            </select>
          </label>

          <label className="block text-xs uppercase tracking-widest text-white/40">
            Digite: ENTRAR COMO USUÁRIO
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="ENTRAR COMO USUÁRIO"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-sm normal-case tracking-normal text-white focus:border-cyan-400/50 focus:outline-none"
            />
          </label>

          {error && (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70 hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            disabled={!canSubmit}
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              try {
                await onConfirm({ reason: reason.trim(), confirmation, mode });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-md border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/30 disabled:opacity-40"
          >
            Iniciar impersonação (15 min)
          </button>
        </div>
      </div>
    </div>
  );
}

function HistorySection({
  rows,
  onStop,
}: {
  rows: Awaited<ReturnType<typeof listImpersonationHistory>>;
  onStop: (id: string) => Promise<void>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-white/80">Histórico recente</h2>
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
            <tr>
              <th className="px-3 py-2 text-left">Iniciada</th>
              <th className="px-3 py-2 text-left">Alvo</th>
              <th className="px-3 py-2 text-left">Modo</th>
              <th className="px-3 py-2 text-left">Motivo</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Encerrada</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-white/40">
                  Sem registros.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 text-white/70">{formatDate(r.started_at)}</td>
                <td className="px-3 py-2">
                  <div className="text-white/90">
                    {r.target_display_name ?? "(sem nome)"}
                  </div>
                  <div className="font-mono text-[11px] text-white/40">
                    {r.target_user_id.slice(0, 8)} · {r.target_role ?? "user"}
                  </div>
                </td>
                <td className="px-3 py-2 text-white/70">{r.mode}</td>
                <td className="px-3 py-2 text-white/70">{r.reason}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "inline-block rounded-md border px-2 py-0.5 text-xs " +
                      (r.status === "active"
                        ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                        : r.status === "revoked" || r.status === "failed"
                          ? "border-red-400/30 bg-red-500/15 text-red-200"
                          : "border-white/15 bg-white/5 text-white/60")
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-white/60">
                  {r.ended_at ? formatDate(r.ended_at) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status === "active" && (
                    <button
                      onClick={() => onStop(r.id)}
                      className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-xs text-amber-100 hover:bg-amber-500/30"
                    >
                      Encerrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
