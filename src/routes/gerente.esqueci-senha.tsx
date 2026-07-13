import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Mail, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { supabase } from "@/integrations/supabase/client";

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
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: FormValues) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/gerente/redefinir-senha`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos um link para seu e-mail.");
    setSent(true);
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
                <CheckCircle2 size={48} className="text-[color:var(--admin-neon)]" />
                <h2 className="mt-4 text-xl font-extrabold text-white">Verifique seu e-mail</h2>
                <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">
                  Se existir uma conta com este e-mail, você receberá um link para redefinir sua senha em instantes.
                </p>
              </div>
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
