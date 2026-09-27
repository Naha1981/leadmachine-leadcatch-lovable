// Server-only client for the external WhatsApp Operator (Baileys) service.
// This app never talks to WhatsApp directly — only to the Operator over HTTPS.
import { createHmac, timingSafeEqual } from "crypto";

export const APP_ID = "leadcatch-sa";

export async function operatorRequest<T = any>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env["OPERATOR_URL"];
  const apiKey = process.env["OPERATOR_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("WhatsApp service is not configured yet (OPERATOR_URL / OPERATOR_API_KEY).");
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", apiKey);
  headers.set("X-App-Id", APP_ID);
  headers.set("X-Tenant-Id", tenantId);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    console.error(`Operator ${path} failed [${res.status}]: ${text}`);
    throw new Error(body?.message || `WhatsApp service error (${res.status})`);
  }
  return body as T;
}

export function sendText(tenantId: string, waAccountId: string, to: string, text: string) {
  return operatorRequest<{ ok: boolean; message?: { key?: { id?: string } } }>(tenantId, "/send", {
    method: "POST",
    body: JSON.stringify({ waAccountId, to, text, type: "text" }),
  });
}

export function verifyOperatorSignature(rawBody: string, signature: string): boolean {
  const secret = process.env["WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
