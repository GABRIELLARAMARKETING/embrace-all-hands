import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ denied: s.denied === "1" ? "1" : undefined }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: rows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const roles = new Set((rows ?? []).map((r) => r.role));
      if (roles.has("admin") || roles.has("super_admin")) {
        throw redirect({ to: "/admin/dashboard" });
      }
    }
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { denied } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setErr(error?.message ?? "Falha no login");
      setLoading(false);
      return;
    }
    const { data: rows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = new Set((rows ?? []).map((r) => r.role));
    if (!roles.has("admin") && !roles.has("super_admin")) {
      await supabase.auth.signOut();
      setErr("Acesso restrito a administradores.");
      setLoading(false);
      return;
    }
    navigate({ to: "/admin/dashboard" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#050810] p-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-cyan-300/70">Helix</div>
          <h1 className="mt-1 text-2xl font-semibold">Admin Panel</h1>
          <p className="mt-1 text-sm text-white/50">Acesso restrito.</p>
        </div>

        {denied && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Você não tem permissão para acessar o painel admin.
          </div>
        )}
        {err && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        )}

        <label className="block text-sm">
          <span className="text-white/70">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-white/70">Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-cyan-500 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
