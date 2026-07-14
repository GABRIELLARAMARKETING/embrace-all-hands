import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gerente/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha · Painel Gerente Helix" },
      { name: "description", content: "Defina uma nova senha para acessar o painel Gerente." },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Za-z]/, "Inclua letras")
      .regex(/[0-9]/, "Inclua números"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });
type FormValues = z.infer<typeof schema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    // Supabase places the recovery token in the URL hash and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If the session is already established (e.g. after refresh), enable the form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async ({ password }: FormValues) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada. Faça login novamente.");
    await supabase.auth.signOut();
    navigate({ to: "/gerente/login" });
  };

  return (
    <div className="admin-theme admin-scroll relative flex min-h-screen w-full items-start justify-center bg-[color:var(--admin-bg)] px-4 py-10 lg:items-center">
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
                Nova senha
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-white">Redefinir senha</h2>
            <p className="mt-1 text-sm text-[color:var(--admin-text-2)]">
              Escolha uma nova senha segura para acessar o painel.
            </p>
          </div>

          {!ready && (
            <div className="mb-4 rounded-[10px] border border-[color:var(--admin-border)] bg-[color:var(--admin-input)] px-3 py-2 text-sm text-[color:var(--admin-text-2)]">
              Validando link de recuperação… abra esta página pelo link enviado no seu e-mail.
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AdminInput
              label="Nova senha"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
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
            <AdminInput
              label="Confirmar nova senha"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              error={form.formState.errors.confirm?.message}
              suffix={<ShieldCheck size={16} className="text-[color:var(--admin-text-3)]" />}
              {...form.register("confirm")}
            />

            <AdminButton
              type="submit"
              fullWidth
              loading={form.formState.isSubmitting}
              disabled={!ready}
            >
              <Lock size={16} className="mr-2" />
              Salvar nova senha
            </AdminButton>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}
