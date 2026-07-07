import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Zap, Loader2, Apple } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Helix Jump" },
      { name: "description", content: "Acesse sua conta para continuar jogando Helix Jump." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(120),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(120),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // If already logged in → go straight to /game
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) navigate({ to: "/game", replace: true });
      else setCheckingSession(false);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "password";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      setSuccess(true);
      toast.success("Login realizado!");
      setTimeout(() => navigate({ to: "/game", replace: true }), 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no login";
      toast.error(msg.includes("Invalid") ? "E-mail ou senha inválidos" : msg);
      setLoading(false);
    }
  }

  async function onGoogle() {
    setOauthLoading("google");
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com Google");
        setOauthLoading(null);
        return;
      }
      if (result.redirected) return;
      // Session set by helper
      navigate({ to: "/game", replace: true });
    } catch {
      toast.error("Falha ao conectar com Google");
      setOauthLoading(null);
    }
  }

  function onApple() {
    // Apple provider is not enabled in this project yet.
    // TODO: enable via Lovable Cloud (supabase--configure_social_auth) and call
    // lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin })
    toast.info("Login com Apple em breve");
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#13002E] text-white/60 text-sm">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8"
      style={{
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        background:
          "radial-gradient(120% 80% at 50% 20%, #3a0f6b 0%, #21094a 35%, #13002E 70%, #0b0018 100%)",
      }}
    >
      {/* Background — soft helix rings + particles */}
      <BackgroundFX />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mb-6 text-center"
        >
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tight"
            style={{
              background:
                "linear-gradient(135deg, #00C8FF 0%, #8B3DFF 45%, #FF2D75 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 4px 24px rgba(139,61,255,0.55))",
            }}
          >
            HELIX JUMP
          </h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-white/50">
            Arcade Premium
          </p>
        </motion.div>

        {/* Card */}
        <div
          className="relative rounded-3xl border border-white/15 bg-white/[0.06] p-6 sm:p-8 backdrop-blur-2xl"
          style={{
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,61,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          {/* Neon top accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 -top-px h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, #00C8FF, #FF2D75, transparent)",
            }}
          />

          {/* Badge icon */}
          <div className="mx-auto -mt-14 mb-4 grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-gradient-to-br from-[#8B3DFF] to-[#FF2D75] shadow-[0_10px_30px_-5px_rgba(255,45,117,0.6)]">
            <Zap className="text-white" size={26} strokeWidth={2.5} />
          </div>

          <h2 className="text-center text-2xl sm:text-3xl font-bold text-white">Entrar</h2>
          <p className="mt-1 text-center text-sm text-[#B9B4D6]">
            Acesse sua conta para continuar jogando
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field
              icon={<Mail size={18} />}
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              value={email}
              onChange={(v) => {
                setEmail(v);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              error={errors.email}
              ariaLabel="E-mail"
            />
            <Field
              icon={<Lock size={18} />}
              type={showPass ? "text" : "password"}
              placeholder="Senha"
              autoComplete="current-password"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
              ariaLabel="Senha"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                  className="text-white/50 transition hover:text-white"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => toast.info("Recuperação de senha em breve")}
                className="text-xs text-[#B9B4D6] transition hover:text-[#00C8FF]"
              >
                Esqueceu sua senha?
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading || success}
              whileHover={{ scale: loading || success ? 1 : 1.02 }}
              whileTap={{ scale: loading || success ? 1 : 0.98 }}
              className="relative h-12 w-full overflow-hidden rounded-2xl text-base font-bold text-white transition disabled:opacity-80"
              style={{
                background:
                  "linear-gradient(135deg, #8B3DFF 0%, #B04CFF 50%, #FF2D75 100%)",
                boxShadow:
                  "0 10px 30px -6px rgba(255,45,117,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
              }}
            >
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.span
                    key="ok"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                  >
                    ✓ Entrando no jogo...
                  </motion.span>
                ) : loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Loader2 className="animate-spin" size={18} /> Entrando...
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Entrar
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-widest text-white/40">
              ou continue com
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SocialButton
              onClick={onGoogle}
              loading={oauthLoading === "google"}
              label="Google"
              icon={<GoogleIcon />}
            />
            <SocialButton
              onClick={onApple}
              loading={oauthLoading === "apple"}
              label="Apple"
              icon={<Apple size={18} className="text-white" fill="currentColor" />}
            />
          </div>

          <p className="mt-6 text-center text-sm text-[#B9B4D6]">
            Não tem conta?{" "}
            <Link
              to="/auth"
              className="font-semibold text-white underline-offset-4 hover:text-[#00C8FF] hover:underline"
            >
              Cadastre-se
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

function Field({
  icon,
  trailing,
  error,
  value,
  onChange,
  ariaLabel,
  ...rest
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div>
      <div
        className={`group flex items-center gap-3 rounded-2xl border bg-white/[0.04] px-4 transition focus-within:bg-white/[0.07] ${
          error
            ? "border-[#FF2D75]/70 focus-within:border-[#FF2D75]"
            : "border-white/10 focus-within:border-[#00C8FF]/70"
        }`}
        style={{
          boxShadow: error
            ? "0 0 0 3px rgba(255,45,117,0.12)"
            : undefined,
        }}
      >
        <span className="text-white/50 group-focus-within:text-[#00C8FF]">{icon}</span>
        <input
          {...rest}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full bg-transparent text-[15px] text-white placeholder-white/40 outline-none"
        />
        {trailing}
      </div>
      {error && (
        <p className="mt-1.5 pl-1 text-xs text-[#FF6E9E]">{error}</p>
      )}
    </div>
  );
}

function SocialButton({
  onClick,
  loading,
  label,
  icon,
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.1] disabled:opacity-70"
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : icon}
      <span>{label}</span>
    </motion.button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c6.9 0 9.5-4.8 9.5-8.7 0-.6-.1-1-.1-1.5H12z"
      />
    </svg>
  );
}

function BackgroundFX() {
  return (
    <>
      {/* Glow blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #8B3DFF 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-1/4 h-72 w-72 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #FF2D75 0%, transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #00C8FF 0%, transparent 60%)" }}
      />

      {/* Helix rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            aria-hidden
            className="absolute rounded-full border"
            style={{
              width: 220 + i * 90,
              height: (220 + i * 90) * 0.28,
              borderColor: "rgba(139,61,255,0.15)",
              boxShadow: `0 0 40px rgba(0,200,255,${0.05 + i * 0.02}) inset`,
            }}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 40 + i * 8, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      {/* Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute block h-1 w-1 rounded-full"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              background: i % 3 === 0 ? "#00C8FF" : i % 3 === 1 ? "#FF2D75" : "#8B3DFF",
              boxShadow: "0 0 8px currentColor",
            }}
            animate={{
              y: [0, -14, 0],
              opacity: [0.3, 0.9, 0.3],
            }}
            transition={{
              duration: 3 + (i % 5),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </>
  );
}
