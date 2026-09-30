export function normalizePhoneNumber(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10) return "27" + digits.slice(1);
  if (digits.startsWith("27")) return digits;
  return digits;
}

export function phonesEqual(a: string | null | undefined, b: string | null | undefined) {
  return normalizePhoneNumber(a) !== "" && normalizePhoneNumber(a) === normalizePhoneNumber(b);
}
