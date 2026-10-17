/** API key generation and verification for the tenant API. */

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.getRandomValues(new Uint8Array(24));
  const body = Array.from(raw).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `rd_live_${body}`;
  return { key, hash: "", prefix: key.slice(0, 12) };
}

export async function hashApiKey(key: string): Promise<string> {
  return sha256Hex(key);
}

/** Resolve a tenant from an x-api-key header; null when invalid or revoked. */
export async function tenantForApiKey(request: Request): Promise<string | null> {
  const key = request.headers.get("x-api-key") ?? "";
  if (!key.startsWith("rd_live_") || key.length < 30) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data, error } = await db
    .from("tenant_api_keys")
    .select("id, tenant_id")
    .eq("key_hash", await hashApiKey(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  await db.from("tenant_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.tenant_id as string;
}
