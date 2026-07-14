import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Eye, EyeOff, Mail, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gerente/criar-conta")({
  head: () => ({
    meta: [
      { title: "Criar conta · Painel Gerente Helix" },
      { name: "description", content: "Solicite acesso ao painel Gerente Helix." },
    ],
  }),
  component: SignupPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo").max(120),
    email: z.string().trim().email("E-mail inválido").max(120),
    password: z
      .string()
      .min(8, "A senha precisa ter no mínimo 8 caracteres")
      .max(120)
      .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
      .regex(/[0-9]/, "Inclua ao menos um número"),
    confirm: z.string(),
    accept: z.literal(true, { errorMap: () => ({ message: "Você precisa aceitar os termos" }) }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem",
  });
type FormValues = z.infer<typeof schema>;

function SignupPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirm: "",
      accept: false as unknown as true,
    },
  });

  const onSubmit = async (values: FormValues) => {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { display_name: values.fullName, full_name: values.fullName },
      },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.user) {
      toast.error("Não foi possível criar a conta.");
      return;
    }
    // Garante sessão ativa e redireciona direto para a área logada
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInErr) {
        toast.error(signInErr.message);
        return;
      }
    }
    toast.success("Conta criada! Redirecionando...");
    navigate({ to: "/gerente", replace: true });
  };

  return (
    <div className="admin-theme admin-scroll relative flex min-h-screen w-full items-start justify-center bg-[color:var(--admin-bg)] px-4 py-10 lg:items-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[color:var(--admin-green)]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[color:var(--admin-neon)]/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_1.05fr]">
        <AdminCard className="w-full order-2 lg:order-1">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xl font-bold">
                <span className="text-white">Helix</span>{" "}
                <span className="text-[color:var(--admin-neon)]">Manager</span>
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--admin-text-3)]">
                Painel Gerente
              </p>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Conta criada</h2>
                <p className="mt-2 text-sm text-[color:var(--admin-text-2)]">
                  Um administrador precisa liberar seu acesso de gerente antes do primeiro login.
                </p>
              </div>
              <AdminButton
                fullWidth
                onClick={() => navigate({ to: "/gerente/login", search: { signup: "1", denied: undefined } })}
              >
                Ir para o login
              </AdminButton>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-white">Criar conta de gerente</h2>
                <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">
                  Preencha seus dados. O acesso de gerente é liberado por um administrador
                  após a criação da conta.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <AdminInput
                  label="Nome completo"
                  type="text"
                  placeholder="Como devemos te chamar"
                  autoComplete="name"
                  error={form.formState.errors.fullName?.message}
                  {...form.register("fullName")}
                />
                <AdminInput
                  label="E-mail corporativo"
                  type="email"
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                  error={form.formState.errors.email?.message}
                  suffix={<Mail size={16} className="text-[color:var(--admin-text-3)]" />}
                  {...form.register("email")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminInput
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mín. 8 caracteres"
                    autoComplete="new-password"
                    error={form.formState.errors.password?.message}
                    hint="Use letras e números"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-[color:var(--admin-text-3)] hover:text-white"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                    {...form.register("password")}
                  />
                  <AdminInput
                    label="Confirmar senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    error={form.formState.errors.confirm?.message}
                    {...form.register("confirm")}
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[color:var(--admin-text-2)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[color:var(--admin-border)] bg-[color:var(--admin-input)] accent-[color:var(--admin-neon)]"
                    {...form.register("accept")}
                  />
                  <span>
                    Declaro que as informações são verdadeiras e concordo com as políticas de uso
                    do painel Helix, incluindo o registro de auditoria de todas as ações.
                  </span>
                </label>
                {form.formState.errors.accept && (
                  <p className="-mt-2 text-xs text-[color:var(--admin-red)]">
                    {form.formState.errors.accept.message as string}
                  </p>
                )}

                <AdminButton type="submit" fullWidth loading={form.formState.isSubmitting}>
                  <UserPlus size={16} className="mr-2" />
                  Criar conta
                </AdminButton>
              </form>

              <p className="mt-6 text-center text-sm text-[color:var(--admin-text-2)]">
                Já tem acesso?{" "}
                <Link
                  to="/gerente/login"
                  className="font-semibold text-[color:var(--admin-neon)] hover:underline"
                >
                  Entrar no painel
                </Link>
              </p>
            </>
          )}
        </AdminCard>

        {/* Brand pane */}
        <div className="order-1 hidden flex-col justify-between rounded-[20px] border border-[color:var(--admin-border)] bg-gradient-to-br from-[color:var(--admin-panel)] to-[color:var(--admin-bg)] p-8 lg:order-2 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[12px] bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">
                  <span className="text-white">Helix</span>{" "}
                  <span className="text-[color:var(--admin-neon)]">Manager</span>
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[color:var(--admin-text-3)]">
                  Cadastro de gerente
                </p>
              </div>
            </div>

            <h1 className="mt-10 text-3xl font-extrabold leading-tight text-white">
              Junte-se à rede de gerentes Helix.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--admin-text-2)]">
              Após criar sua conta, um administrador libera seu acesso de gerente. A partir
              daí você acompanha indicados, comissões e saques em um único painel.
            </p>
          </div>

          <ul className="mt-10 space-y-3 text-sm text-[color:var(--admin-text-2)]">
            {[
              "Verificação de identidade antes da liberação",
              "Auditoria completa de todas as ações",
              "Suporte prioritário a gerentes ativos",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
                  <ShieldCheck size={14} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
