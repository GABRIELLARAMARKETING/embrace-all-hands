import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, UserPlus, Loader2, ChevronLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Criar conta — Helix Multi" },
      { name: "description", content: "Crie sua conta Helix Multi grátis e comece a jogar." },
    ],
  }),
  component: SignupPage,
});

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

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; password?: string }>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    const errs: typeof errors = {};
    if (name.trim().length < 2) errs.name = "Informe seu nome";
    if (digits.length < 10) errs.phone = "Telefone inválido";
    if (password.length < 6) errs.password = "Mínimo 6 caracteres";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: phoneToEmail(phone),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: name.trim(), phone: digits },
        },
      });
      if (error) throw error;
      setSuccess(true);
      toast.success("Conta criada!");
      setTimeout(() => navigate({ to: "/game", replace: true }), 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar conta";
      toast.error(msg);
      setLoading(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-8"
      style={{
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        background:
          "radial-gradient(120% 80% at 50% 10%, #0f3d24 0%, #0a2716 40%, #05130b 80%, #020806 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="relative rounded-[28px] border border-emerald-400/25 bg-gradient-to-b from-emerald-950/60 to-black/70 p-6 sm:p-8 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 60px -10px rgba(16,185,129,0.35)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 -top-px h-px"
            style={{ background: "linear-gradient(90deg, transparent, #34d399, #10b981, transparent)" }}
          />

          <div className="flex flex-col items-center">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_10px_30px_-6px_rgba(16,185,129,0.7)]"
            >
              <Zap className="text-white" size={26} strokeWidth={2.6} />
            </motion.div>
            <p className="mt-2 text-[11px] font-black tracking-[0.28em] text-emerald-300">
              HELIX MULTI
            </p>
          </div>

          <div className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
              Crie sua conta grátis
            </span>
          </div>

          <h1 className="mt-5 text-center text-3xl sm:text-4xl font-extrabold text-white">
            Comece a ganhar agora
          </h1>
          <p className="mt-1.5 text-center text-sm text-emerald-100/60">
            Preencha os dados e entre no jogo
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
            <Field
              label="Nome completo"
              placeholder="Seu nome completo"
              autoComplete="name"
              value={name}
              onChange={(v) => {
                setName(v);
                if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
              }}
              error={errors.name}
            />
            <Field
              label="Telefone (WhatsApp)"
              placeholder="(11) 99999-0000"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(v) => {
                setPhone(formatPhone(v));
                if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
              }}
              error={errors.phone}
            />
            <Field
              label="Senha"
              placeholder="Mínimo 6 caracteres"
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
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
                  className="text-emerald-300/60 transition hover:text-emerald-200"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/40 p-4 text-xs leading-relaxed text-emerald-100/70">
              Ao criar conta você concorda com os{" "}
              <a href="#" className="font-bold text-emerald-400 hover:text-emerald-300">
                Termos de Uso
              </a>{" "}
              e confirma ter mais de 18 anos.
            </div>

            <motion.button
              type="submit"
              disabled={loading || success}
              whileHover={{ scale: loading || success ? 1 : 1.02 }}
              whileTap={{ scale: loading || success ? 1 : 0.97 }}
              className="relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full text-base font-extrabold uppercase tracking-wider text-white transition disabled:opacity-80"
              style={{
                background: "linear-gradient(180deg, #22e08a 0%, #10b981 55%, #059669 100%)",
                boxShadow:
                  "0 14px 34px -6px rgba(16,185,129,0.65), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.15)",
              }}
            >
              <AnimatePresence mode="wait">
                {success ? (
                  <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    ✓ Entrando...
                  </motion.span>
                ) : loading ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={20} /> Criando conta
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <UserPlus size={20} /> Criar conta grátis
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-emerald-400/15" />
            <span className="text-xs text-emerald-200/50">ou</span>
            <div className="h-px flex-1 bg-emerald-400/15" />
          </div>

          <p className="text-center text-sm text-emerald-100/70">
            Já tem conta?{" "}
            <Link to="/login" className="font-extrabold text-emerald-400 hover:text-emerald-300">
              Fazer login
            </Link>
          </p>

          <button
            type="button"
            onClick={() => navigate({ to: "/game" })}
            className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-emerald-100/50 hover:text-emerald-200"
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
      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100/80">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-full border bg-emerald-950/40 px-5 transition focus-within:bg-emerald-950/60 ${
          error
            ? "border-rose-400/70 focus-within:border-rose-400"
            : "border-emerald-400/25 focus-within:border-emerald-400"
        }`}
      >
        <input
          {...rest}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full bg-transparent text-[15px] text-white placeholder-emerald-100/30 outline-none"
        />
        {trailing}
      </div>
      {error && <p className="mt-1.5 pl-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
