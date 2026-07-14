import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, LogIn, Loader2, ChevronLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { assertAuthCredentials, normalizeEmail, validateEmail, validatePassword } from "@/lib/authValidation";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Helix Multi" },
      { name: "description", content: "Acesse sua conta Helix Multi para continuar jogando." },
    ],
  }),
  component: LoginPage,
});

// Phone (WhatsApp) is the identifier. We map it to a synthetic email for Supabase auth.
function phoneToEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@helix-multi.app`;
}
function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) navigate({ to: "/app/jogar", replace: true });
      else setCheckingSession(false);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const isEmail = identifier.includes("@");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    let emailToUse = "";
    if (isEmail) {
      const emailErr = validateEmail(identifier);
      if (emailErr) errs.identifier = emailErr;
      emailToUse = normalizeEmail(identifier);
    } else {
      const digits = identifier.replace(/\D/g, "");
      if (digits.length < 10) errs.identifier = "Telefone ou email inválido";
      emailToUse = phoneToEmail(digits);
    }
    const pwErr = validatePassword(password);
    if (pwErr) errs.password = pwErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      // Guarda backend: revalida senha (e email quando aplicável) antes do Supabase
      if (isEmail) assertAuthCredentials(emailToUse, password);
      else if (validatePassword(password)) throw new Error(validatePassword(password)!);
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });
      if (error) throw error;
      setSuccess(true);
      toast.success("Login realizado!");
      setTimeout(() => navigate({ to: "/app/jogar", replace: true }), 500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const lower = raw.toLowerCase();
      let msg = "Não foi possível entrar. Tente novamente.";
      if (lower.includes("invalid") || lower.includes("credentials"))
        msg = "Email/telefone ou senha incorretos.";
      else if (lower.includes("invalid login") || lower.includes("invalid credentials"))
        msg = "Email ou senha incorretos.";
      else if (lower.includes("rate") || lower.includes("too many"))
        msg = "Muitas tentativas. Aguarde alguns minutos.";
      else if (lower.includes("network") || lower.includes("fetch"))
        msg = "Falha de conexão. Verifique sua internet.";
      else if (raw) msg = raw;
      toast.error(msg);
      setLoading(false);
    }
  }



  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0c0326] text-violet-300/60">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  return (
    <main
      className="auth-scroll relative flex min-h-screen w-full items-start justify-center px-4 py-8 sm:items-center"
      style={{
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        background:
          "radial-gradient(120% 80% at 50% 10%, #2a0f5c 0%, #180740 40%, #0c0326 80%, #050110 100%)",
      }}
    >
      <GreenFX />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="relative rounded-[28px] border border-violet-400/25 bg-gradient-to-b from-violet-950/60 to-black/70 p-6 sm:p-8 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px -10px rgba(139,92,246,0.35)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 -top-px h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #c084fc, #8b5cf6, transparent)",
            }}
          />

          {/* Logo */}
          <div className="flex flex-col items-center">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 shadow-[0_10px_30px_-6px_rgba(139,92,246,0.7)]"
            >
              <Zap className="text-white" size={26} strokeWidth={2.6} />
            </motion.div>
            <p className="mt-2 text-[11px] font-black tracking-[0.28em] text-violet-300">
              HELIX MULTI
            </p>
          </div>

          {/* Pill */}
          <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_#c084fc]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">
              Acesse sua conta
            </span>
          </div>

          <h1 className="mt-5 text-center text-3xl sm:text-4xl font-extrabold text-white">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-center text-sm text-violet-100/60">
            Entre para continuar jogando
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
            <Field
              label="Email ou telefone"
              placeholder="voce@exemplo.com ou (11) 99999-0000"
              inputMode={isEmail ? "email" : "numeric"}
              autoComplete="username"
              value={identifier}
              onChange={(v) => {
                setIdentifier(v.includes("@") ? v : formatPhone(v));
                if (errors.identifier) setErrors((e) => ({ ...e, identifier: undefined }));
              }}
              error={errors.identifier}
            />

            <Field
              label="Senha"
              placeholder="Sua senha"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  className="text-violet-300/60 transition hover:text-violet-200"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => toast.info("Recuperação de senha em breve")}
                className="text-sm font-bold text-violet-400 hover:text-violet-300"
              >
                Esqueci minha senha
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading || success}
              whileHover={{ scale: loading || success ? 1 : 1.02 }}
              whileTap={{ scale: loading || success ? 1 : 0.97 }}
              className="relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full text-base font-extrabold uppercase tracking-wider text-white transition disabled:opacity-80"
              style={{
                background:
                  "linear-gradient(180deg, #a855f7 0%, #8b5cf6 55%, #6d28d9 100%)",
                boxShadow:
                  "0 14px 34px -6px rgba(139,92,246,0.65), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.15)",
              }}
            >
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    ✓ Entrando...
                  </motion.span>
                ) : loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} /> Entrando
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <LogIn size={20} /> Entrar
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-violet-400/15" />
            <span className="text-xs text-violet-200/50">ou</span>
            <div className="h-px flex-1 bg-violet-400/15" />
          </div>

          <p className="text-center text-sm text-violet-100/70">
            Não tem conta?{" "}
            <Link
              to="/auth"
              className="font-extrabold text-violet-400 hover:text-violet-300"
            >
              Cadastre-se grátis
            </Link>
          </p>

          <button
            type="button"
            onClick={() => navigate({ to: "/game" })}
            className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-violet-100/50 hover:text-violet-200"
          >
            <ChevronLeft size={16} /> Voltar ao início
          </button>
        </div>
      </motion.div>
    </main>
  );
}

function Field({
  label,
  trailing,
  error,
  value,
  onChange,
  ...rest
}: {
  label: string;
  trailing?: React.ReactNode;
  error?: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-violet-100/80">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-full border bg-violet-950/40 px-5 transition focus-within:bg-violet-950/60 ${
          error
            ? "border-rose-400/70 focus-within:border-rose-400"
            : "border-violet-400/25 focus-within:border-violet-400"
        }`}
      >
        <input
          {...rest}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full bg-transparent text-[15px] text-white placeholder-violet-100/30 outline-none"
        />
        {trailing}
      </div>
      {error && <p className="mt-1.5 pl-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function GreenFX() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-1/4 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #c084fc 0%, transparent 65%)" }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute block h-1 w-1 rounded-full bg-violet-300"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              boxShadow: "0 0 8px currentColor",
            }}
            animate={{ y: [0, -14, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 3 + (i % 5), repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>
    </>
  );
}
