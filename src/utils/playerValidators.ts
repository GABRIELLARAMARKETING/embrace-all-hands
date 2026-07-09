import { z } from "zod";
import { cpfDigits } from "./cpfMask";
import { PLAYER_MOCK } from "@/data/playerMockData";

const ALLOWED_DEPOSIT_AMOUNTS = PLAYER_MOCK.depositOptions as readonly number[];

export const depositSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Selecione um valor" })
    .refine(
      (v) => ALLOWED_DEPOSIT_AMOUNTS.includes(v),
      "Selecione um dos valores disponíveis",
    ),
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
