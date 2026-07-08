import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gerente/login")({
  head: () => ({
    meta: [
      { title: "Entrar · Gerente Helix" },
      { name: "description", content: "Acesse o painel Gerente Helix." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    denied: s.denied === "1" ? "1" : undefined,
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(120),
  password: z.string().min(6, "Senha muito curta").max(120),
});
type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/gerente/login" });
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

    // Verifica papel antes de deixar entrar
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = new Set((rows ?? []).map((r) => r.role));
    if (!roles.has("admin") && !roles.has("super_admin")) {
      await supabase.auth.signOut();
      toast.error("Sem permissão para acessar o painel.");
      return;
    }

    toast.success("Bem-vindo!");
    navigate({ to: "/gerente/painel" });
  };

  return (
    <div className="admin-theme admin-scroll flex min-h-screen w-full items-center justify-center bg-[color:var(--admin-bg)] px-4">
      <AdminCard className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[color:var(--admin-green)]/15 text-[color:var(--admin-neon)]">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xl font-bold">
              <span className="text-white">Gerente</span>{" "}
              <span className="text-[color:var(--admin-neon)]">Helix</span>
            </p>
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--admin-text-3)]">
              Painel Gerente
            </p>
          </div>
        </div>

        {search.denied && (
          <div className="mb-4 rounded-[10px] border border-[color:var(--admin-red)]/40 bg-[color:var(--admin-red)]/10 px-3 py-2 text-sm text-[color:var(--admin-red)]">
            Sua conta não tem permissão para acessar o painel.
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <AdminInput
            label="E-mail"
            type="email"
            placeholder="voce@exemplo.com"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <AdminInput
            label="Senha"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={form.formState.errors.password?.message}
            {...form.register("password")}
          />
          <AdminButton type="submit" fullWidth loading={form.formState.isSubmitting}>
            Entrar
          </AdminButton>
        </form>
      </AdminCard>
    </div>
  );
}
