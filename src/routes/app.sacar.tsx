import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Coins, CheckCircle2 } from "lucide-react";
import { AppLayout, GradientButton, PlayerCard } from "@/components/player/AppLayout";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { makeWithdrawSchema, type WithdrawFormValues } from "@/utils/playerValidators";
import { maskCpf } from "@/utils/cpfMask";
import helixLogo from "@/assets/helix-multi-logo.png";

export const Route = createFileRoute("/app/sacar")({
  head: () => ({
    meta: [
      { title: "Solicitar Saque — MultiHelixBr" },
      { name: "description", content: "Solicite saque via PIX." },
    ],
  }),
  component: SacarPage,
});

function SacarPage() {
  const balance = usePlayerStore((s) => s.balance);
  const [done, setDone] = useState(false);
  const schema = useMemo(() => makeWithdrawSchema(balance), [balance]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WithdrawFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: undefined as unknown as number, pixKey: "", cpf: "" },
  });

  const onSubmit = () => {
    setDone(true);
    reset({ amount: undefined as unknown as number, pixKey: "", cpf: "" });
  };

  return (
    <AppLayout title="Solicitar Saque">
      <form onSubmit={handleSubmit(onSubmit)} className="relative pt-12">
        <Logo />
        <PlayerCard className="p-5 pt-10">
          <div className="flex items-center gap-2 text-sm">
            <Coins className="h-4 w-4 text-[#FFD600]" />
            <span className="text-white/70">Saldo disponível:</span>
            <span className="font-bold text-white">{formatCurrency(balance)}</span>
          </div>

          <div className="mt-4 space-y-3">
            <Field label="R$" error={errors.amount?.message}>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Mínimo R$20,00"
                {...register("amount", { valueAsNumber: true })}
                className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
              />
            </Field>

            <Field label="PIX" error={errors.pixKey?.message}>
              <input
                {...register("pixKey")}
                placeholder="Chave PIX (e-mail, telefone ou chave aleatória)"
                className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
              />
            </Field>

            <Field label="CPF" error={errors.cpf?.message}>
              <Controller
                control={control}
                name="cpf"
                render={({ field }) => (
                  <input
                    value={field.value}
                    onChange={(e) => field.onChange(maskCpf(e.target.value))}
                    inputMode="numeric"
                    placeholder="CPF do titular (somente números)"
                    className="w-full bg-transparent text-white outline-none placeholder:text-white/40"
                  />
                )}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#7a2a3f]/60 bg-[#3a1420]/60 px-4 py-3 text-xs text-white/80">
            <Clock className="h-4 w-4 text-[#EC5FA3]" />
            Saques processados em até 24h úteis.
          </div>

          <GradientButton type="submit" className="mt-5">
            Solicitar Saque
          </GradientButton>
        </PlayerCard>
      </form>

      <SuccessModal open={done} onClose={() => setDone(false)} />
    </AppLayout>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3">
        <span className="min-w-[36px] text-sm font-bold text-white/50">{label}</span>
        {children}
      </div>
      {error && <p className="mt-1 pl-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Logo() {
  return (
    <div className="mt-2 flex justify-center">
      <div className="rounded-2xl bg-gradient-to-br from-[#7c1e9c] to-[#1e0938] px-6 py-3 shadow-[0_0_28px_rgba(168,85,247,0.45)]">
        <div className="text-2xl font-black tracking-tighter">
          <span className="bg-gradient-to-r from-[#00D084] via-[#FFD600] to-[#EC5FA3] bg-clip-text text-transparent">
            Helix
          </span>
          <span className="ml-1 text-white/90">MULTI</span>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#160828] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
            <h3 className="mt-3 text-lg font-bold">Solicitação enviada</h3>
            <p className="mt-1 text-sm text-white/70">Seu pedido foi registrado para análise.</p>
            <GradientButton onClick={onClose} className="mt-5">
              OK
            </GradientButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
