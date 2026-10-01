// Server-only client for the external WhatsApp Operator (Baileys) service.
// This app never talks to WhatsApp directly — only to the Operator over HTTPS.
import { createHmac, timingSafeEqual } from "crypto";

export const APP_ID = "leadcatch-sa";

type OperatorAuthOptions = {
  auth?: "tenant" | "platform";
};

type OperatorTenantCredential = {
  tenantToken: string;
  waAccountId?: string | null;
};

async function getStoredTenantCredential(tenantId: string): Promise<OperatorTenantCredential | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("whatsapp_operator_credentials")
    .select("tenant_token, wa_account_id")
    .eq("app_id", APP_ID)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`WhatsApp tenant credential lookup failed: ${error.message}`);
  if (!data?.tenant_token) return null;

  return {
    tenantToken: data.tenant_token as string,
    waAccountId: (data.wa_account_id as string | null | undefined) ?? null,
  };
}

export async function saveOperatorTenantCredential(
  tenantId: string,
  waAccountId: string,
  tenantToken: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { error } = await db
    .from("whatsapp_operator_credentials")
    .upsert(
      {
        app_id: APP_ID,
        tenant_id: tenantId,
        wa_account_id: waAccountId,
        tenant_token: tenantToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "app_id,tenant_id" },
    );

  if (error) throw new Error(`WhatsApp tenant credential save failed: ${error.message}`);
}

/**
 * The platform API key is used only for provisioning/credential rotation.
 * Normal account operations use a tenant-scoped token issued by the Operator.
 * A legacy platform-key fallback remains for already-connected tenants whose
 * token has not yet been stored locally.
 */
export async function operatorRequest<T = any>(
  tenantId: string,
  path: string,
  init: RequestInit = {},
  options: OperatorAuthOptions = {},
): Promise<T> {
  const baseUrl = process.env["OPERATOR_URL"] || "https://my-own-whatsapp-2z5h.onrender.com";
  const apiKey = process.env["OPERATOR_API_KEY"];
  if (!baseUrl) {
    throw new Error("WhatsApp service is not configured yet (OPERATOR_URL).");
  }

  const headers = new Headers(init.headers);
  headers.set("X-App-Id", APP_ID);
  headers.set("X-Tenant-Id", tenantId);

  const authMode = options.auth ?? "tenant";
  if (authMode === "platform") {
    if (!apiKey) {
      throw new Error("WhatsApp provisioning is not configured yet (OPERATOR_API_KEY).");
    }
    headers.set("X-API-Key", apiKey);
  } else {
    const stored = await getStoredTenantCredential(tenantId);
    if (stored?.tenantToken) {
      headers.set("X-NahaLabs-Tenant-Token", stored.tenantToken);
    } else {
      if (!apiKey) {
        throw new Error("WhatsApp tenant credential is missing and OPERATOR_API_KEY is not configured.");
      }
      headers.set("X-API-Key", apiKey);
    }
  }

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

export async function ensureOperatorTenantCredential(
  tenantId: string,
  waAccountId: string,
  bootstrapToken?: string | null,
): Promise<string> {
  const existing = await getStoredTenantCredential(tenantId);
  if (bootstrapToken) {
    await saveOperatorTenantCredential(tenantId, waAccountId, bootstrapToken);
    return bootstrapToken;
  }
  if (existing?.tenantToken) {
    if (existing.waAccountId !== waAccountId) {
      await saveOperatorTenantCredential(tenantId, waAccountId, existing.tenantToken);
    }
    return existing.tenantToken;
  }

  // The Operator never exposes an existing tenant token again. Because the
  // LeadMachine copy is missing, rotate the tenant-scoped credential once.
  const issued = await operatorRequest<{ tenantToken?: string }>(
    tenantId,
    "/accounts/tenant-token",
    {
      method: "POST",
      body: JSON.stringify({ appId: APP_ID, tenantId, rotate: true }),
    },
    { auth: "platform" },
  );

  if (!issued.tenantToken) {
    throw new Error("WhatsApp Operator did not return a tenant credential.");
  }

  await saveOperatorTenantCredential(tenantId, waAccountId, issued.tenantToken);
  return issued.tenantToken;
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
