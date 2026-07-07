import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminButton } from "@/components/admin/AdminButton";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Entrar · Gerente Helix" },
      { name: "description", content: "Acesse o painel Gerente Helix." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(120),
  password: z.string().min(4, "Senha muito curta").max(120),
});
type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: FormValues) => {
    // No real auth yet — just store a local flag so the UI can gate later.
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "gerente-helix:auth",
        JSON.stringify({ email: values.email, at: Date.now() }),
      );
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/admin/painel" });
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
              Painel Admin
            </p>
          </div>
        </div>

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

        <p className="mt-6 text-center text-xs text-[color:var(--admin-text-3)]">
          Ambiente de desenvolvimento — autenticação real será conectada pelo backend.
        </p>
      </AdminCard>
    </div>
  );
}
