import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CreditCard, Info, ShoppingCart, Trash2, UserPlus } from "lucide-react";
import { TopHeader } from "@/components/admin/TopHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { useAdminStore } from "@/store/useAdminStore";
import { notificationService } from "@/services/notificationService";
import { webhookSchema } from "@/utils/validators";
import { sanitizeUrl } from "@/utils/sanitize";

export const Route = createFileRoute("/admin/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações · Gerente Helix" },
      { name: "description", content: "Configure alertas via Pushcut." },
    ],
  }),
  component: NotificacoesPage,
});

const events = [
  {
    key: "signup" as const,
    icon: <UserPlus size={18} />,
    title: "Cadastro Realizado",
    text: "Alguém da sua rede se cadastrou — inclui N1, N2 ou N3",
  },
  {
    key: "deposit" as const,
    icon: <CreditCard size={18} />,
    title: "Depósito Realizado",
    text: "Alguém da sua rede fez um depósito — inclui valor e nível (N1/N2/N3)",
  },
  {
    key: "sale" as const,
    icon: <ShoppingCart size={18} />,
    title: "Venda Aprovada",
    text: "Você recebeu uma comissão — inclui valor e nível da comissão",
  },
];

function NotificacoesPage() {
  const notifications = useAdminStore((s) => s.notifications);
  const toggleEvent = useAdminStore((s) => s.toggleNotificationEvent);
  const [url, setUrl] = useState(notifications.webhookUrl);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const sanitized = sanitizeUrl(url);
    const result = webhookSchema.safeParse({ url: sanitized });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "URL inválida");
      return;
    }
    setError(null);
    setSaving(true);
    await notificationService.update({ webhookUrl: sanitized });
    setSaving(false);
    toast.success("Webhook salvo");
  };

  const test = async () => {
    const res = await notificationService.test();
    if (res.ok) toast.success("Webhook testado com sucesso");
    else toast.error(res.error ?? "Falha ao testar webhook");
  };

  const remove = async () => {
    setUrl("");
    await notificationService.remove();
    toast.success("Webhook removido");
  };

  return (
    <>
      <TopHeader
        title="Notificações"
        subtitle="Configure alertas no seu iPhone via Pushcut"
      />
      <div className="space-y-4 p-4 sm:p-6">
        <AdminCard className="border-[color:var(--admin-blue)]/30 bg-[color:var(--admin-blue)]/8">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 shrink-0 text-[color:var(--admin-blue)]" size={20} />
            <div>
              <h3 className="text-base font-semibold text-white">
                Como configurar em 3 passos:
              </h3>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[color:var(--admin-text-2)]">
                <li>Instale o app Pushcut na App Store (iPhone)</li>
                <li>Abra o app → Automation Server → copie sua API Key</li>
                <li>Cole aqui no campo abaixo e salve — pronto!</li>
              </ol>
              <p className="mt-3 rounded-[8px] bg-[color:var(--admin-input)] px-3 py-2 font-mono text-xs text-[color:var(--admin-text-2)]">
                https://api.pushcut.io/SUA_API_KEY/notifications/MinhaNotificacao
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <h3 className="text-base font-semibold text-white">Webhook URL</h3>
          <div className="mt-4">
            <AdminInput
              placeholder="https://api.pushcut.io/SUA_API_KEY/notifications/NomeDaNotificacao"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              error={error ?? undefined}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AdminButton onClick={save} loading={saving}>
              Salvar
            </AdminButton>
            <AdminButton variant="blue" onClick={test} leftIcon={<Bell size={16} />}>
              Testar
            </AdminButton>
            <AdminButton variant="danger" onClick={remove} leftIcon={<Trash2 size={16} />}>
              Remover
            </AdminButton>
          </div>
        </AdminCard>

        <AdminCard>
          <h3 className="text-base font-semibold text-white">Eventos para notificar</h3>
          <div className="mt-4 space-y-3">
            {events.map((ev) => (
              <div
                key={ev.key}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[color:var(--admin-blue)]/15 text-[color:var(--admin-blue)]">
                    {ev.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{ev.title}</p>
                    <p className="text-xs text-[color:var(--admin-text-2)]">{ev.text}</p>
                  </div>
                </div>
                <ToggleSwitch
                  color="blue"
                  checked={notifications.enabledEvents[ev.key]}
                  onChange={() => toggleEvent(ev.key)}
                />
              </div>
            ))}
          </div>
        </AdminCard>
      </div>
    </>
  );
}
