import { z } from "zod";

export const demoAccountSchema = z.object({
  namePattern: z
    .string()
    .trim()
    .min(1, "Informe o padrão de nome")
    .max(30, "Máx. 30 caracteres")
    .regex(/^[a-zA-Z0-9_-]+$/, "Use apenas letras, números, _ e -"),
  passwordPattern: z.string().trim().max(30, "Máx. 30 caracteres").optional(),
  quantity: z
    .number({ invalid_type_error: "Informe a quantidade" })
    .int("Deve ser inteiro")
    .min(1, "Mínimo 1")
    .max(100, "Máximo 100"),
  initialBalance: z
    .number({ invalid_type_error: "Informe o saldo" })
    .min(0, "Saldo não pode ser negativo")
    .max(1000, "Máx. R$ 1.000 por conta demo"),
});

export type DemoAccountFormValues = z.infer<typeof demoAccountSchema>;

export const withdrawalSchema = z.object({
  pixKey: z
    .string()
    .trim()
    .min(3, "Chave PIX inválida")
    .max(120, "Chave PIX muito longa"),
  amount: z
    .number({ invalid_type_error: "Informe o valor" })
    .positive("Valor deve ser maior que zero"),
});

export type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

export const webhookSchema = z.object({
  url: z
    .string()
    .trim()
    .url("URL inválida")
    .max(500, "URL muito longa")
    .refine((v) => /^https?:\/\//i.test(v), "Deve começar com http(s)://"),
});
export type WebhookFormValues = z.infer<typeof webhookSchema>;

export const commissionSchema = z
  .object({
    n1: z.number().min(0).max(100).nullable(),
    n2: z.number().min(0).max(100).nullable(),
    n3: z.number().min(0).max(100).nullable(),
    budget: z.number().min(0).max(100),
  })
  .refine(
    ({ n1, n2, n3, budget }) => (n1 ?? 0) + (n2 ?? 0) + (n3 ?? 0) <= budget,
    { message: "Soma N1+N2+N3 ultrapassa o orçamento" },
  );
