import { z } from "zod";

/**
 * Validador Zod para server functions que não recebem argumentos.
 * Aceita apenas `undefined`. Qualquer payload inesperado dispara um
 * erro 400 uniforme antes de o handler executar.
 */
export const noInput = (raw: unknown): void => {
  const result = z.undefined().safeParse(raw);
  if (!result.success) {
    const err = new Error("Bad Request: this endpoint does not accept input");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
};
