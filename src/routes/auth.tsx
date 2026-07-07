import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/PrimaryButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Helix Multi" },
      { name: "description", content: "Entre ou crie sua conta para desbloquear temas no Helix Multi." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail se necessário.");
      }
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na autenticação";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center px-4 py-10"
      style={{
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        background:
          "radial-gradient(120% 80% at 50% 40%, #3a0f52 0%, #310840 30%, #21002f 65%, #180026 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]"
      >
        <h1 className="text-center text-2xl font-black tracking-wide text-white">
          {mode === "login" ? "ENTRAR" : "CRIAR CONTA"}
        </h1>
        <p className="mt-1 text-center text-sm text-white/60">Helix Multi</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nome de exibição"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-fuchsia-400/60"
            />
          )}
          <input
            required
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-fuchsia-400/60"
          />
          <input
            required
            type="password"
            minLength={6}
            placeholder="Senha (mín. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-fuchsia-400/60"
          />

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "ENTRAR" : "CADASTRAR"}
          </PrimaryButton>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="mt-4 w-full text-center text-sm text-white/70 underline underline-offset-4 hover:text-fuchsia-200"
        >
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>

        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="mt-6 block w-full text-center text-xs text-white/40 hover:text-white/70"
        >
          Voltar ao jogo
        </button>
      </motion.div>
    </main>
  );
}
