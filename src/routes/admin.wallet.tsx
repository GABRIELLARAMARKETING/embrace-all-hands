import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminSearchUsers,
  adminGetWallet,
  adminAdjustBalance,
} from "@/lib/admin-wallet.functions";

export const Route = createFileRoute("/admin/wallet")({
  component: AdminWalletPage,
});

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ActionType = "credit" | "debit" | "reset";

function AdminWalletPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ActionType | null>(null);
  const qc = useQueryClient();

  const search = useServerFn(adminSearchUsers);
  const getWallet = useServerFn(adminGetWallet);
  const adjust = useServerFn(adminAdjustBalance);

  const searchQ = useQuery({
    queryKey: ["admin-wallet-search", query],
    queryFn: () => search({ data: { query } }),
    enabled: query.trim().length >= 2,
  });

  const walletQ = useQuery({
    queryKey: ["admin-wallet-detail", selectedId],
    queryFn: () => getWallet({ data: { userId: selectedId! } }),
    enabled: !!selectedId,
  });

  const wallet = walletQ.data?.ok ? walletQ.data : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Gerenciar Saldo dos Usuários</h1>
        <p className="mt-1 text-sm text-white/60">
          Ajustes manuais de saldo. Todas as ações são registradas em ledger e auditoria.
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">
          Buscar por ID, nome, código de afiliado, telefone ou CPF
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: joão, ABC123, 5511..."
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />
        {searchQ.isFetching && (
          <p className="mt-2 text-xs text-white/40">Buscando...</p>
        )}
        {searchQ.data?.users && searchQ.data.users.length > 0 && (
          <ul className="mt-3 divide-y divide-white/5 rounded-lg border border-white/5">
            {searchQ.data.users.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => setSelectedId(u.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    selectedId === u.id ? "bg-cyan-500/10 text-cyan-200" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium">{u.display_name ?? "—"}</span>
                    <span className="ml-2 text-xs text-white/40">
                      {u.affiliate_code ?? u.id.slice(0, 8)}
                    </span>
                  </span>
                  <span className="text-xs text-white/60">{BRL(Number(u.balance))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedId && walletQ.isLoading && (
        <p className="text-sm text-white/60">Carregando carteira...</p>
      )}
      {selectedId && walletQ.data && !walletQ.data.ok && (
        <p className="text-sm text-red-400">Usuário não encontrado.</p>
      )}

      {wallet && (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs uppercase tracking-wider text-white/50">Usuário</div>
              <div className="mt-2 text-lg font-semibold">
                {wallet.profile.display_name ?? "—"}
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-white/60">
                <div>ID: {wallet.profile.id}</div>
                <div>Status: {wallet.profile.status}</div>
                <div>Roles: {wallet.roles.join(", ") || "user"}</div>
                {wallet.profile.affiliate_code && (
                  <div>Afiliado: {wallet.profile.affiliate_code}</div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="text-xs uppercase tracking-wider text-emerald-300/80">
                Saldo disponível
              </div>
              <div className="mt-2 text-3xl font-bold text-emerald-300">
                {BRL(Number(wallet.profile.balance))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs uppercase tracking-wider text-white/50">
                Totais
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div>
                  Depositado:{" "}
                  <span className="font-semibold">
                    {BRL(wallet.totals.totalDeposited)}
                  </span>
                </div>
                <div>
                  Sacado:{" "}
                  <span className="font-semibold">
                    {BRL(wallet.totals.totalWithdrawn)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            <ActionButton onClick={() => setModal("credit")} tone="emerald">
              + Adicionar saldo
            </ActionButton>
            <ActionButton onClick={() => setModal("debit")} tone="amber">
              − Retirar saldo
            </ActionButton>
            <ActionButton onClick={() => setModal("reset")} tone="red">
              ⚠ Resetar saldo
            </ActionButton>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02]">
            <header className="border-b border-white/5 px-4 py-3">
              <h2 className="text-sm font-semibold">Histórico de ajustes manuais</h2>
            </header>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0a0f1a] text-white/50">
                  <tr>
                    <th className="px-4 py-2">Data</th>
                    <th className="px-4 py-2">Admin</th>
                    <th className="px-4 py-2">Ação</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-right">Antes → Depois</th>
                    <th className="px-4 py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {wallet.history.adjustments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-white/40">
                        Sem ajustes manuais.
                      </td>
                    </tr>
                  )}
                  {wallet.history.adjustments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-white/70">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2">{a.admin_display_name ?? a.admin_user_id.slice(0, 8)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            a.action === "credit"
                              ? "text-emerald-300"
                              : a.action === "debit"
                                ? "text-amber-300"
                                : "text-red-300"
                          }
                        >
                          {a.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {BRL(Number(a.amount))}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-white/70">
                        {BRL(Number(a.balance_before))} → {BRL(Number(a.balance_after))}
                      </td>
                      <td className="px-4 py-2 text-white/70">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {modal && (
            <AdjustModal
              action={modal}
              userId={wallet.profile.id}
              currentBalance={Number(wallet.profile.balance)}
              onClose={() => setModal(null)}
              onSubmit={async (payload) => {
                const res = await adjust({ data: { ...payload, userId: wallet.profile.id } });
                if (!res.ok) {
                  toast.error(`Falha: ${res.reason ?? "erro"}`);
                  return;
                }
                toast.success(
                  `Saldo atualizado: ${BRL(res.balance_before ?? 0)} → ${BRL(res.balance_after ?? 0)}`,
                );
                setModal(null);
                await qc.invalidateQueries({ queryKey: ["admin-wallet-detail", selectedId] });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "emerald" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
        : "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20";
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${cls}`}
    >
      {children}
    </button>
  );
}

function AdjustModal({
  action,
  userId,
  currentBalance,
  onClose,
  onSubmit,
}: {
  action: ActionType;
  userId: string;
  currentBalance: number;
  onClose: () => void;
  onSubmit: (payload: {
    action: ActionType;
    amount?: number;
    reason: string;
    note?: string;
    confirmation?: string;
    idempotencyKey: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const title =
    action === "credit"
      ? "Adicionar saldo"
      : action === "debit"
        ? "Retirar saldo"
        : "Resetar saldo";

  const needAmount = action !== "reset";
  const needConfirmation = action === "reset";

  const submit = async () => {
    if (reason.trim().length < 3) {
      toast.error("Motivo obrigatório (mín. 3 caracteres)");
      return;
    }
    let value: number | undefined;
    if (needAmount) {
      value = Number(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) {
        toast.error("Valor inválido");
        return;
      }
      if (action === "debit" && value > currentBalance) {
        toast.error("Valor maior que o saldo atual");
        return;
      }
    }
    if (needConfirmation && confirmation !== "RESETAR SALDO") {
      toast.error('Digite "RESETAR SALDO" para confirmar');
      return;
    }
    setSubmitting(true);
    try {
      const key = `admin_wallet:${userId}:${action}:${value ?? "reset"}:${Date.now()}`;
      await onSubmit({
        action,
        amount: value,
        reason: reason.trim(),
        note: note.trim() || undefined,
        confirmation: needConfirmation ? confirmation : undefined,
        idempotencyKey: key,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f1a] p-6 shadow-2xl">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1 text-xs text-white/50">
          Saldo atual: <span className="font-mono">{BRL(currentBalance)}</span>
        </p>

        {action === "credit" && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Este valor será registrado como <b>crédito manual administrativo</b> e não será
            contabilizado como depósito real do usuário no dashboard.
          </div>
        )}
        {action === "debit" && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            Esta operação será registrada como <b>débito manual administrativo</b> e ficará
            separada dos saques reais do usuário.
          </div>
        )}

        <div className="mt-4 space-y-3">

          {needAmount && (
            <div>
              <label className="mb-1 block text-xs text-white/60">Valor (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 10.00"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-white/60">
              Motivo <span className="text-red-400">*</span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Ex: Correção de saldo lançado incorretamente"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Observação interna</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400"
            />
          </div>
          {needConfirmation && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-red-200">
                Esta ação é destrutiva. Digite <b>RESETAR SALDO</b> para confirmar.
              </p>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                className="mt-2 w-full rounded-lg border border-red-500/40 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-400"
              />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? "Aplicando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
