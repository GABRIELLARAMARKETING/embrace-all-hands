// Regras únicas de validação para Email e Senha, compartilhadas entre
// o cadastro (/auth) e o login (/login).

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72; // limite do bcrypt no Supabase

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normaliza email removendo espaços e caixa alta. */
export function normalizeEmail(raw: string): string {
  return (raw ?? "").replace(/\s+/g, "").toLowerCase();
}

/** Retorna mensagem de erro ou null se válido. */
export function validateEmail(raw: string): string | null {
  const v = normalizeEmail(raw);
  if (!v) return "Informe seu email";
  if (!v.includes("@")) return "Email deve conter '@'";
  if (!EMAIL_REGEX.test(v)) return "Formato de email inválido (ex.: voce@exemplo.com)";
  if (v.length > EMAIL_MAX) return "Email muito longo";
  return null;
}

/** Retorna mensagem de erro ou null se válido. */
export function validatePassword(raw: string): string | null {
  const v = raw ?? "";
  if (!v) return "Informe sua senha";
  if (v.length < PASSWORD_MIN) return `Mínimo ${PASSWORD_MIN} caracteres`;
  if (v.length > PASSWORD_MAX) return `Máximo ${PASSWORD_MAX} caracteres`;
  return null;
}
