import { normalizePhoneNumber } from "./zero-ui-phone.server";

export async function getZeroUIConfig(db: any, tenantId: string) {
  const existing = await db.from("zero_ui_configs").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (existing.data) return existing.data;
  const created = await db.from("zero_ui_configs").insert({ tenant_id: tenantId }).select("*").single();
  if (created.error) throw created.error;
  return created.data;
}

export async function resolveWhatsAppTenant(db: any, tenantId: string, waAccountId: string) {
  const { data: profile, error } = await db
    .from("business_profiles")
    .select("tenant_id,business_name,industry,services,suburb,working_hours,contact_phone,wa_account_id,whatsapp_number,whatsapp_status")
    .eq("tenant_id", tenantId)
    .eq("wa_account_id", waAccountId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) throw new Error("WhatsApp account is not bound to the supplied tenant");
  return {
    tenantId: profile.tenant_id as string,
    profile,
    ownerPhone: normalizePhoneNumber(profile.contact_phone || ""),
  };
}

export async function requireTenantRole(db: any, userId: string, tenantId: string, roles: string[]) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .in("role", roles)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Insufficient tenant permissions");
  return data.role as string;
}
