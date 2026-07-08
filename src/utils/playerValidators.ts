import { z } from "zod";
import { cpfDigits } from "./cpfMask";

export const depositSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Informe o valor" })
    .min(20, "Depósito mínimo R$ 20,00")
    .max(100000, "Valor muito alto"),
  coupon: z.string().trim().max(30).optional(),
});
export type DepositFormValues = z.infer<typeof depositSchema>;

export const makeWithdrawSchema = (balance: number) =>
  z.object({
    amount: z
      .number({ invalid_type_error: "Informe o valor" })
      .min(20, "Mínimo R$ 20,00")
      .refine((v) => v <= balance, "Valor maior que o saldo disponível"),
    pixKey: z.string().trim().min(3, "Chave PIX obrigatória").max(120),
    cpf: z
      .string()
      .transform((v) => cpfDigits(v))
      .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  });
export type WithdrawFormValues = z.infer<ReturnType<typeof makeWithdrawSchema>>;
