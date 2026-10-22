import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function tenantForUser(db: any, userId: string) {
  const { data, error } = await db
    .from("tenants")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Workspace not found");
  return data.id as string;
}

/** Status only — never returns the stored key. */
export const getHiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const { data } = await db
      .from("tenant_integrations")
      .select("status, external_label, verified_at")
      .eq("tenant_id", tenantId)
      .eq("provider", "nahalabs-ai")
      .maybeSingle();
    if (!data || data.status !== "connected") return { connected: false as const };
    return { connected: true as const, label: data.external_label, verifiedAt: data.verified_at };
  });

/** Verify the key against the live service, then store it server-side. */
export const connectHi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { apiKey?: string })
  .handler(async ({ context, data }) => {
    const key = (data.apiKey ?? "").trim();
    if (!key) throw new Error("Paste your API key first.");
    if (key.length > 200) throw new Error("That key looks too long.");
    const { verifyHiKey, saveHiConnection } = await import("@/lib/hi.server");
    const { label } = await verifyHiKey(key); // throws with a user-safe message when invalid
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    await saveHiConnection(tenantId, key, label);
    return { connected: true as const, label };
  });

export const disconnectHi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const { clearHiConnection } = await import("@/lib/hi.server");
    await clearHiConnection(tenantId);
    return { connected: false as const };
  });
