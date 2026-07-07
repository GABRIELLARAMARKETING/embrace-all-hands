/**
 * Basic sanitization: strips angle brackets to prevent HTML injection when
 * values are rendered as text, and enforces a max length.
 */
export function sanitizeText(value: string, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").slice(0, maxLength).trim();
}

export function sanitizeUrl(value: string): string {
  const v = sanitizeText(value, 500);
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) return "";
  return v;
}
