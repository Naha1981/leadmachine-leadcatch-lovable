import { createHmac, timingSafeEqual } from "node:crypto";

const MIN_FORM_FILL_MS = 2_500;
const MAX_FORM_TOKEN_AGE_MS = 2 * 60 * 60 * 1_000;
const DEV_SECRET = "leadmachine-development-only-quote-form-secret";

function secret(): string {
  const value = process.env["QUOTE_FORM_TOKEN_SECRET"] || process.env["WEBHOOK_SECRET"];
  if (value) return value;
  if (process.env["NODE_ENV"] !== "production") return DEV_SECRET;
  throw new Error("QUOTE_FORM_TOKEN_SECRET or WEBHOOK_SECRET is required.");
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createQuoteFormToken(slug: string, issuedAt = Date.now()): string {
  const payload = JSON.stringify({ slug: slug.trim().toLowerCase(), issuedAt });
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function validateQuoteFormToken(
  token: string,
  slug: string,
  now = Date.now(),
): { ok: true; issuedAt: number } | { ok: false; reason: "invalid" | "too_fast" | "expired" } {
  try {
    const [encoded, providedSignature] = token.split(".");
    if (!encoded || !providedSignature || providedSignature.length !== 64) return { ok: false, reason: "invalid" };

    const expectedSignature = sign(encoded);
    const provided = Buffer.from(providedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return { ok: false, reason: "invalid" };
    }

    const payload = JSON.parse(decode(encoded)) as { slug?: unknown; issuedAt?: unknown };
    if (payload.slug !== slug.trim().toLowerCase() || typeof payload.issuedAt !== "number") {
      return { ok: false, reason: "invalid" };
    }

    const age = now - payload.issuedAt;
    if (age < MIN_FORM_FILL_MS) return { ok: false, reason: "too_fast" };
    if (age > MAX_FORM_TOKEN_AGE_MS || age < -30_000) return { ok: false, reason: "expired" };

    return { ok: true, issuedAt: payload.issuedAt };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export const QUOTE_FORM_MIN_FILL_MS = MIN_FORM_FILL_MS;
