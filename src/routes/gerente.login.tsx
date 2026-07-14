import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gerente/login")({
  head: () => ({
    meta: [
      { title: "Entrar · Painel Gerente Helix" },
      { name: "description", content: "Acesse o painel Gerente Helix com sua conta autorizada." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    denied: s.denied === "1" ? "1" : undefined,
    signup: s.signup === "1" ? "1" : undefined,
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(120),
  password: z.string().min(6, "Senha muito curta").max(120),
});
type FormValues = z.infer<typeof schema>;

const ALLOWED_ROLES = new Set(["admin", "super_admin", "gerente"]);

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/gerente/login" });
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error || !data.user) {
      toast.error(error?.message ?? "Falha no login");
      return;
    }

    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = new Set((rows ?? []).map((r) => r.role));
    const hasAccess = [...roles].some((r) => ALLOWED_ROLES.has(r));
    if (!hasAccess) {
      await supabase.auth.signOut();
      toast.error("Sem permissão para acessar o painel.");
      return;
    }

    toast.success("Bem-vindo!");
    navigate({ to: "/gerente/painel" });
  };

  return (
    <div className="admin-theme admin-scroll relative flex min-h-screen w-full items-center justify-center bg-[color:var(--admin-bg)] px-4 py-10">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[color:var(--admin-green)]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[color:var(--admin-neon)]/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand pane */}
        <div className="hidden flex-col justify-between rounded-[20px] border border-[color:var(--admin-border)] bg-gradient-to-br from-[color:var(--admin-panel)] to-[color:var(--admin-bg)] p-8 lg:flex">
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
                  Painel restrito de gestão
                </p>
              </div>
            </div>
            <h1 className="mt-10 text-3xl font-extrabold leading-tight text-white">
              Controle total sobre indicados, comissões e saques.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--admin-text-2)]">
              Um painel dedicado para gerentes e administradores acompanharem em tempo real
              a performance da rede e liberarem pagamentos com segurança.
            </p>
          </div>

          <ul className="mt-10 space-y-3 text-sm text-[color:var(--admin-text-2)]">
            {[
              "Autenticação com verificação de papel",
              "Saques auditados e rastreáveis",
              "Comissões multinível em tempo real",
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

        {/* Form pane */}
        <AdminCard className="w-full">
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

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-white">Entrar no painel</h2>
            <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">
              Use sua conta autorizada de gerente ou administrador.
            </p>
          </div>

          {search.denied && (
            <div className="mb-4 rounded-[10px] border border-[color:var(--admin-red)]/40 bg-[color:var(--admin-red)]/10 px-3 py-2 text-sm text-[color:var(--admin-red)]">
              Sua conta não tem permissão para acessar o painel.
            </div>
          )}
          {search.signup && (
            <div className="mb-4 rounded-[10px] border border-[color:var(--admin-green)]/40 bg-[color:var(--admin-green)]/10 px-3 py-2 text-sm text-[color:var(--admin-neon)]">
              Conta criada! Aguarde um administrador liberar seu acesso de gerente.
            </div>
          )}

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
            <AdminInput
              label="Senha"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
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

            <AdminButton type="submit" fullWidth loading={form.formState.isSubmitting}>
              <Lock size={16} className="mr-2" />
              Entrar no painel
            </AdminButton>

            <div className="flex justify-end">
              <Link
                to="/gerente/esqueci-senha"
                className="text-xs font-medium text-[color:var(--admin-text-2)] hover:text-[color:var(--admin-neon)]"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>


          <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--admin-text-3)]">
            <span className="h-px flex-1 bg-[color:var(--admin-border)]" />
            ou
            <span className="h-px flex-1 bg-[color:var(--admin-border)]" />
          </div>

          <Link
            to="/gerente/criar-conta"
            className="mt-5 flex items-center justify-center rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-[color:var(--admin-green)] hover:text-[color:var(--admin-neon)]"
          >
            Criar conta de gerente
          </Link>

          <p className="mt-6 text-center text-[11px] text-[color:var(--admin-text-3)]">
            Este painel é restrito. Acessos não autorizados são registrados.
          </p>
        </AdminCard>
      </div>
    </div>
  );
}
