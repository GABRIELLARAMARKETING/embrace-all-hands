import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Clock, Mail, MailCheck, RefreshCw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { supabase } from "@/integrations/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

export const Route = createFileRoute("/gerente/esqueci-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha · Painel Gerente Helix" },
      { name: "description", content: "Solicite um link para redefinir sua senha do painel Gerente." },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(120),
});
type FormValues = z.infer<typeof schema>;

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState<string>("");
  const [cooldown, setCooldown] = useState(0);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/gerente/redefinir-senha`,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const onSubmit = async ({ email }: FormValues) => {
    const ok = await sendReset(email);
    if (!ok) return;
    toast.success("Enviamos um link para seu e-mail.");
    setSentTo(email);
    setSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const onResend = async () => {
    if (cooldown > 0 || !sentTo) return;
    const ok = await sendReset(sentTo);
    if (!ok) return;
    toast.success("Link reenviado.");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <div className="admin-theme admin-scroll relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[color:var(--admin-bg)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[color:var(--admin-green)]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[color:var(--admin-neon)]/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <AdminCard>
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xl font-bold">
                <span className="text-white">Helix</span>{" "}
                <span className="text-[color:var(--admin-neon)]">Manager</span>
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--admin-text-3)]">
                Recuperar acesso
              </p>
            </div>
          </div>

          {sent ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-[color:var(--admin-green)]/15">
                  <CheckCircle2 size={40} className="text-[color:var(--admin-neon)]" />
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">E-mail enviado!</h2>
                <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">
                  Enviamos um link de redefinição de senha para
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <MailCheck size={16} className="text-[color:var(--admin-neon)]" />
                  {sentTo}
                </p>
              </div>

              <div className="rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)]/60 p-4">
                <div className="flex items-start gap-3">
                  <Clock size={18} className="mt-0.5 shrink-0 text-[color:var(--admin-neon)]" />
                  <div className="space-y-1 text-xs text-[color:var(--admin-text-2)]">
                    <p className="font-semibold text-white">Tempo estimado de entrega: 1 a 3 minutos</p>
                    <p>Verifique também sua caixa de spam ou lixo eletrônico.</p>
                    <p>O link expira em <span className="font-semibold text-white">1 hora</span> por segurança.</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onResend}
                disabled={cooldown > 0}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[color:var(--admin-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[color:var(--admin-text-2)] transition-colors hover:border-[color:var(--admin-green)] hover:text-[color:var(--admin-neon)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={14} />
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail"}
              </button>

              <Link
                to="/gerente/login"
                className="flex items-center justify-center gap-2 rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[color:var(--admin-green)] hover:text-[color:var(--admin-neon)]"
              >
                <ArrowLeft size={16} />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-white">Esqueci minha senha</h2>
                <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">
                  Informe seu e-mail e enviaremos um link para redefinir a senha.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <AdminInput
                  label="E-mail"
                  type="email"
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                  error={form.formState.errors.email?.message}
                  suffix={<Mail size={16} className="text-[color:var(--admin-text-3)]" />}
                  {...form.register("email")}
                />

                <AdminButton type="submit" fullWidth loading={form.formState.isSubmitting}>
                  <Send size={16} className="mr-2" />
                  Enviar link de recuperação
                </AdminButton>
              </form>

              <Link
                to="/gerente/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm text-[color:var(--admin-text-2)] hover:text-white"
              >
                <ArrowLeft size={14} />
                Voltar ao login
              </Link>
            </>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
