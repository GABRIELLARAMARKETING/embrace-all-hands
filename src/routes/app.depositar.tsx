import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DollarSign, Tag, X, Copy, Loader2 } from "lucide-react";
import { AppLayout, GradientButton, PlayerCard } from "@/components/player/AppLayout";
import { PLAYER_MOCK, DEPOSIT_BADGES } from "@/data/playerMockData";
import { usePlayerStore } from "@/store/usePlayerStore";
import { formatCurrency } from "@/utils/formatCurrency";
import { depositSchema, type DepositFormValues } from "@/utils/playerValidators";
import { maskCpf, cpfDigits } from "@/utils/cpfMask";
import { copyToClipboard } from "@/utils/clipboard";
import { cn } from "@/lib/utils";
import helixLogo from "@/assets/helix-multi-logo.png";
import { createDiggionDeposit, getDepositStatus } from "@/lib/deposits.functions";

export const Route = createFileRoute("/app/depositar")({
  head: () => ({
    meta: [
      { title: "Depositar via PIX — Helix Fast" },
      { name: "description", content: "Deposite via PIX de forma segura pelo gateway Diggion Pay." },
    ],
  }),
  component: DepositarPage,
});

const BADGE_COLORS: Record<string, string> = {
  min: "bg-[#FF9F0A] text-black",
  hot: "bg-[#00D084] text-black",
  pop: "bg-[#EF4444] text-white",
  bonus: "bg-[#EC5FA3] text-white",
};

const kycSchema = z.object({
  fullName: z.string().trim().min(3, "Nome completo obrigatório").max(120),
  email: z.string().trim().email("E-mail inválido").max(200),
  cpf: z.string().transform(cpfDigits).refine((v) => v.length === 11, "CPF inválido"),
  phone: z.string().transform((v) => v.replace(/\D/g, "")).refine((v) => v.length >= 10 && v.length <= 13, "Telefone inválido"),
});
type KycValues = z.infer<typeof kycSchema>;

function DepositarPage() {
  const balance = usePlayerStore((s) => s.balance);
  const [showCoupon, setShowCoupon] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [pending, setPending] = useState<null | {
    depositId: string;
    qrCode: string | null;
    copyPasteCode: string | null;
    checkoutUrl: string | null;
    amount: number;
    expiresAt: string | null;
  }>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 20 },
  });
  const amount = watch("amount");

  const onSubmit = () => setKycOpen(true);

  return (
    <AppLayout title="Depositar via PIX">
      <div className="relative pt-14">
        <GameLogo />

        <PlayerCard className="p-4 pt-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold tracking-widest text-white/60">SALDO ATUAL</div>
              <div className="text-2xl font-black text-emerald-400">{formatCurrency(balance)}</div>
            </div>
            <div className="shrink-0 text-right text-xs text-white/50 leading-tight">
              disponível<br />na conta
            </div>
          </div>
        </PlayerCard>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <PlayerCard className="mt-4 p-4">
          <div className="text-[11px] font-bold tracking-widest text-[#C084FC]">VALOR RÁPIDO</div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {PLAYER_MOCK.depositOptions.map((v) => {
              const badge = DEPOSIT_BADGES[v];
              const active = amount === v;
              const isBonus = badge?.tone === "bonus";
              return (
                <div key={v} className="relative pt-3">
                  {badge && (
                    <span
                      className={cn(
                        "absolute -top-0 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wide shadow",
                        BADGE_COLORS[badge.tone],
                      )}
                    >
                      {badge.label}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setValue("amount", v, { shouldValidate: true })}
                    className={cn(
                      "flex w-full flex-col items-center justify-center rounded-full px-2 py-2 text-sm font-black transition-all",
                      isBonus
                        ? "border-2 border-[#FFD600] bg-[#1a0b2e] text-white shadow-[0_0_14px_rgba(255,214,0,0.35)]"
                        : active
                          ? "bg-gradient-to-r from-[#A855F7] to-[#EC5FA3] text-white shadow-[0_0_18px_rgba(168,85,247,0.55)]"
                          : "bg-white/[0.05] text-white/80",
                      active && isBonus && "ring-2 ring-[#EC5FA3]/60",
                    )}
                  >
                    <span>R${v}</span>
                    {isBonus && (
                      <span className="text-[9px] font-black text-[#00D084]">+100%</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-3">
            <span className="text-sm font-semibold text-white/60">R$</span>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              {...register("amount", { valueAsNumber: true })}
              className="w-full bg-transparent text-lg font-bold text-white outline-none"
            />
          </div>
          {errors.amount && (
            <p className="mt-2 text-xs text-red-400">{errors.amount.message}</p>
          )}

          <button
            type="button"
            onClick={() => setShowCoupon((v) => !v)}
            className="mt-3 flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <Tag className="h-4 w-4" /> Tenho um cupom
          </button>
          {showCoupon && (
            <input
              {...register("coupon")}
              placeholder="Código do cupom"
              className="mt-2 w-full rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
            />
          )}
        </PlayerCard>

        <GradientButton type="submit" className="mt-4">
          Gerar QR Code PIX
        </GradientButton>
      </form>

      <KycModal
        open={kycOpen}
        onClose={() => setKycOpen(false)}
        amount={amount}
        onSuccess={(res) => {
          setKycOpen(false);
          setPending(res);
        }}
      />
      <PixQrModal
        open={!!pending}
        onClose={() => setPending(null)}
        data={pending}
      />
    </AppLayout>
  );
}

function GameLogo() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
      <img
        src={helixLogo}
        alt="Helix Multi"
        width={112}
        height={112}
        loading="lazy"
        className="h-28 w-28 drop-shadow-[0_0_20px_rgba(168,85,247,0.55)]"
      />
    </div>
  );
}

function KycModal({
  open,
  onClose,
  amount,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: (res: {
    depositId: string;
    qrCode: string | null;
    copyPasteCode: string | null;
    checkoutUrl: string | null;
    amount: number;
    expiresAt: string | null;
  }) => void;
}) {
  const createFn = useServerFn(createDiggionDeposit);
  const [cpfMasked, setCpfMasked] = useState("");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<KycValues>({
    resolver: zodResolver(kycSchema),
  });

  const mutation = useMutation({
    mutationFn: async (v: KycValues) => {
      return createFn({
        data: {
          amount,
          fullName: v.fullName,
          email: v.email,
          cpf: v.cpf,
          phone: v.phone,
        },
      });
    },
    onSuccess: (res) => {
      onSuccess({
        depositId: res.depositId,
        qrCode: res.qrCode,
        copyPasteCode: res.copyPasteCode,
        checkoutUrl: res.checkoutUrl,
        amount: res.amount,
        expiresAt: res.expiresAt,
      });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Falha ao gerar depósito");
    },
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            onSubmit={handleSubmit((v) => mutation.mutate(v))}
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#160828] p-6"
            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={onClose} className="absolute right-4 top-4 text-white/60 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Confirme seus dados</h3>
            <p className="mt-1 text-xs text-white/60">
              Depósito de <span className="font-bold text-white">{formatCurrency(amount)}</span> via PIX (Diggion Pay).
            </p>

            <div className="mt-4 space-y-2">
              <Field label="Nome completo" error={errors.fullName?.message}>
                <input {...register("fullName")} className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="E-mail" error={errors.email?.message}>
                <input type="email" {...register("email")} className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white outline-none" />
              </Field>
              <Field label="CPF" error={errors.cpf?.message as string}>
                <input
                  inputMode="numeric"
                  value={cpfMasked}
                  onChange={(e) => {
                    const m = maskCpf(e.target.value);
                    setCpfMasked(m);
                    setValue("cpf", cpfDigits(m) as unknown as string, { shouldValidate: true });
                  }}
                  className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white outline-none"
                />
              </Field>
              <Field label="Telefone (com DDD)" error={errors.phone?.message as string}>
                <input
                  inputMode="tel"
                  placeholder="11999999999"
                  {...register("phone")}
                  className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-sm text-white outline-none"
                />
              </Field>
            </div>

            <GradientButton type="submit" disabled={mutation.isPending} className="mt-5 flex items-center justify-center gap-2">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mutation.isPending ? "Gerando PIX..." : "Gerar PIX"}
            </GradientButton>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold tracking-widest text-white/60">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-red-400">{error}</span>}
    </label>
  );
}

function PixQrModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: null | {
    depositId: string;
    qrCode: string | null;
    copyPasteCode: string | null;
    checkoutUrl: string | null;
    amount: number;
    expiresAt: string | null;
  };
}) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getDepositStatus);

  // Polling de status
  const { data: status } = useQuery({
    queryKey: ["deposit-status", data?.depositId],
    queryFn: () => statusFn({ data: { depositId: data!.depositId } }),
    enabled: !!data?.depositId && open,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      if (s === "paid" || s === "expired" || s === "canceled" || s === "failed") return false;
      return 4000;
    },
  });

  useEffect(() => {
    if (status?.status === "paid") {
      toast.success("Pagamento confirmado! Saldo creditado.");
      qc.invalidateQueries();
    } else if (status?.status === "expired") {
      toast.error("PIX expirado. Gere um novo depósito.");
    }
  }, [status?.status, qc]);

  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#160828] p-6 text-center"
            initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute right-4 top-4 text-white/60 hover:text-white" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold text-white">
              {status?.status === "paid" ? "Pagamento confirmado ✅" : "Pague com PIX"}
            </h3>
            <p className="mt-1 text-xs text-white/60">
              {status?.status === "paid"
                ? "Seu saldo já foi creditado."
                : "Escaneie o QR Code ou copie o código abaixo."}
            </p>

            {data.qrCode && status?.status !== "paid" && (
              <div className="mx-auto mt-5 grid h-56 w-56 place-items-center rounded-2xl bg-white p-3">
                {data.qrCode.startsWith("data:") || data.qrCode.startsWith("http") ? (
                  <img src={data.qrCode} alt="QR PIX" className="h-full w-full object-contain" />
                ) : (
                  <div className="break-all p-2 text-[9px] text-black">{data.qrCode.slice(0, 400)}</div>
                )}
              </div>
            )}

            <div className="mt-4 text-sm text-white/70">
              Valor: <span className="font-bold text-white">{formatCurrency(data.amount)}</span>
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              Status: <span className="font-bold">{status?.status ?? "carregando..."}</span>
            </div>

            {status?.status !== "paid" && (
              <div className="mt-4 flex flex-col gap-2">
                {data.copyPasteCode && (
                  <GradientButton
                    onClick={async () => {
                      const ok = await copyToClipboard(data.copyPasteCode!);
                      toast[ok ? "success" : "error"](ok ? "Código PIX copiado!" : "Falha ao copiar");
                    }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" /> Copiar código PIX
                  </GradientButton>
                )}
                {data.checkoutUrl && (
                  <a
                    href={data.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
                  >
                    Abrir checkout
                  </a>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-3 w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-white/80 hover:bg-white/5"
            >
              Fechar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
