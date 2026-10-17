import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function tenantForUser(db: any, userId: string) {
  const { data, error } = await db.from("tenants").select("id").eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Workspace not found");
  return data.id as string;
}

export const getDeveloperSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const [{ data: keys }, { data: hooks }, { data: deliveries }] = await Promise.all([
      db
        .from("tenant_api_keys")
        .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }),
      db.from("tenant_webhooks").select("id, url, events, active, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      db
        .from("webhook_deliveries")
        .select("id, event, status, ok, error, attempted_at")
        .eq("tenant_id", tenantId)
        .order("attempted_at", { ascending: false })
        .limit(10),
    ]);
    return {
      apiKeys: (keys ?? []).filter((k: any) => !k.revoked_at),
      webhooks: hooks ?? [],
      deliveries: deliveries ?? [],
    };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { label?: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const { generateApiKey, hashApiKey } = await import("@/lib/api-keys.server");
    const { key, prefix } = generateApiKey();
    const { error } = await db.from("tenant_api_keys").insert({
      tenant_id: tenantId,
      label: (data.label ?? "").trim().slice(0, 80) || "Default",
      key_hash: await hashApiKey(key),
      key_prefix: prefix,
    });
    if (error) throw new Error("Could not create API key");
    return { key };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { id: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    if (!data.id) throw new Error("Missing key id");
    const { error } = await db
      .from("tenant_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error("Could not revoke API key");
    return { ok: true };
  });

export const saveWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { url: string; events?: string[] })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const url = (data.url ?? "").trim();
    if (!/^https:\/\/.+\..+/.test(url)) throw new Error("Webhook URL must start with https://");
    if (url.length > 300) throw new Error("Webhook URL is too long");
    const events = Array.isArray(data.events) && data.events.length ? data.events : ["lead.created"];
    const secret = crypto.getRandomValues(new Uint8Array(24)).reduce((acc, b) => acc + b.toString(16).padStart(2, "0"), "");
    const { error } = await db.from("tenant_webhooks").insert({ tenant_id: tenantId, url, secret, events, active: true });
    if (error) throw new Error("Could not save webhook");
    return { secret };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { id: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    if (!data.id) throw new Error("Missing webhook id");
    const { error } = await db.from("tenant_webhooks").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error("Could not delete webhook");
    return { ok: true };
  });
