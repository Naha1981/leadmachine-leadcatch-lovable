import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getZeroUIConfig, requireTenantRole } from "./zero-ui-tenant.server";
import { normalizePhoneNumber } from "./zero-ui-phone.server";

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

export const getZeroUISettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    await requireTenantRole(db, context.userId, tenantId, ["owner", "admin"]);
    const config = await getZeroUIConfig(db, tenantId);
    const { data: profile } = await db
      .from("business_profiles")
      .select("business_name,contact_phone,whatsapp_number,whatsapp_status,wa_account_id")
      .eq("tenant_id", tenantId)
      .single();
    return {
      tenantId,
      enabled: Boolean(config["enabled"]),
      automationEnabled: Boolean(config["automation_enabled"]),
      ownerAlertsEnabled: Boolean(config["owner_alerts_enabled"]),
      autoFollowupsEnabled: Boolean(config["auto_followups_enabled"]),
      requireFollowupApproval: Boolean(config.require_followup_approval),
      ownerAlertPhone: normalizePhoneNumber(profile?.contact_phone),
      whatsappStatus: profile?.whatsapp_status ?? "disconnected",
      whatsappConnected: Boolean(profile?.wa_account_id) && profile?.whatsapp_status === "connected",
    };
  });

export const setZeroUISettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => {
    const v = value as { enabled?: boolean; automationEnabled?: boolean; ownerAlertsEnabled?: boolean; autoFollowupsEnabled?: boolean };
    return v;
  })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    await requireTenantRole(db, context.userId, tenantId, ["owner", "admin"]);

    if (data.enabled === true) {
      const { data: profile } = await db
        .from("business_profiles")
        .select("contact_phone,wa_account_id,whatsapp_status")
        .eq("tenant_id", tenantId)
        .single();
      if (!profile?.contact_phone) throw new Error("Set the owner alert number before enabling Zero UI.");
      if (!profile?.wa_account_id || profile?.whatsapp_status !== "connected") {
        throw new Error("Connect the business WhatsApp number before enabling Zero UI.");
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof data.enabled === "boolean") patch["enabled"] = data.enabled;
    if (typeof data.automationEnabled === "boolean") patch["automation_enabled"] = data.automationEnabled;
    if (typeof data.ownerAlertsEnabled === "boolean") patch["owner_alerts_enabled"] = data.ownerAlertsEnabled;
    if (typeof data.autoFollowupsEnabled === "boolean") patch["auto_followups_enabled"] = data.autoFollowupsEnabled;

    await db.from("zero_ui_configs").update(patch).eq("tenant_id", tenantId);

    await db.from("zero_ui_audit_logs").insert({
      tenant_id: tenantId,
      actor_type: "user",
      actor_id: context.userId,
      action: "zero_ui_settings_updated",
      result: "success",
      metadata: patch,
    });

    const config = await getZeroUIConfig(db, tenantId);
    return {
      ok: true,
      enabled: Boolean(config.enabled),
      automationEnabled: Boolean(config.automation_enabled),
      ownerAlertsEnabled: Boolean(config.owner_alerts_enabled),
      autoFollowupsEnabled: Boolean(config.auto_followups_enabled),
    };
  });

