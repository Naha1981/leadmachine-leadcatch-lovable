/** Normalise a South African phone number to E.164 (+27...). Returns null if invalid. */
export function toE164(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "27" + d.slice(1);
  if (!/^\d{10,15}$/.test(d)) return null;
  return "+" + d;
}

/** Display +27821234567 as +27 82 123 4567 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const m = /^\+27(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+27 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
