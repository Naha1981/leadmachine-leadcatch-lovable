import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently delete the caller's account: their workspace (tenant) row — which
 * cascades to every table that holds their data — and then their auth user.
 * Runs with the service role because only the admin API may delete auth users.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tenant, error: tenantLookupError } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (tenantLookupError) throw new Error("Could not look up the workspace");

    if (tenant?.id) {
      const { error } = await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      if (error) throw new Error("Could not delete the workspace data");
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error("Could not delete the account");

    return { ok: true };
  });
