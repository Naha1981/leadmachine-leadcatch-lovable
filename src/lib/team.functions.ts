import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function tenantForUser(db: any, userId: string) {
  const { data, error } = await db.from("tenants").select("id").eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Only the workspace owner can manage the team");
  return data.id as string;
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const [{ data: roles }, { data: invites }] = await Promise.all([
      db.from("user_roles").select("user_id, role").eq("tenant_id", tenantId),
      db
        .from("tenant_invites")
        .select("id, email, role, created_at, accepted_at")
        .eq("tenant_id", tenantId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    const memberIds = (roles ?? []).map((r: any) => r.user_id);
    const { data: profiles } = memberIds.length
      ? await db.from("profiles").select("id, email, full_name").in("id", memberIds)
      : { data: [] };
    const emailFor = new Map((profiles ?? []).map((p: any) => [p.id, p.email as string]));
    return {
      members: (roles ?? []).map((r: any) => ({ userId: r.user_id, role: r.role, email: emailFor.get(r.user_id) ?? "" })),
      invites: invites ?? [],
    };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { email: string; origin: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    const email = (data.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    const { data: profile } = await db.from("business_profiles").select("business_name").eq("tenant_id", tenantId).maybeSingle();
    const { error } = await db.from("tenant_invites").upsert(
      { tenant_id: tenantId, email, role: "agent", invited_by: context.userId, business_name: profile?.business_name ?? "" },
      { onConflict: "tenant_id,email" },
    );
    if (error) throw new Error("Could not create invite");
    // Send the Supabase invite email when the person has no account yet; if they do, they will
    // see the invite on their next sign-in.
    try {
      const origin = /^https:\/\//.test(data.origin ?? "") ? data.origin : "";
      await db.auth.admin.inviteUserByEmail(email, origin ? { redirectTo: `${origin}/accept-invite` } : undefined);
    } catch (e) {
      console.warn("inviteUserByEmail failed (user may already exist)", e);
    }
    return { ok: true };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { id: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    if (!data.id) throw new Error("Missing invite id");
    const { error } = await db.from("tenant_invites").delete().eq("id", data.id).eq("tenant_id", tenantId);
    if (error) throw new Error("Could not revoke invite");
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { userId: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const tenantId = await tenantForUser(db, context.userId);
    if (!data.userId) throw new Error("Missing user id");
    const { error } = await db
      .from("user_roles")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", data.userId)
      .neq("role", "owner");
    if (error) throw new Error("Could not remove team member");
    // Detach their profile so tenant membership checks stop passing for this workspace.
    const { data: own } = await db.from("tenants").select("id").eq("owner_id", data.userId).maybeSingle();
    await db.from("profiles").update({ tenant_id: own?.id ?? null }).eq("id", data.userId).eq("tenant_id", tenantId);
    return { ok: true };
  });

export const myPendingInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const email = String(context.claims?.email ?? "").toLowerCase();
    if (!email) return { invites: [] };
    const { data } = await db
      .from("tenant_invites")
      .select("id, business_name, role, created_at")
      .ilike("email", email)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    return { invites: data ?? [] };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => value as { id: string })
  .handler(async ({ context, data }) => {
    const db = await adminDb();
    const email = String(context.claims?.email ?? "").toLowerCase();
    if (!data.id || !email) throw new Error("Invite not found");
    const { data: invite } = await db
      .from("tenant_invites")
      .select("id, tenant_id, email, role, accepted_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!invite || invite.accepted_at) throw new Error("Invite not found");
    if (invite.email.toLowerCase() !== email) throw new Error("This invite is addressed to a different email");
    const { error: roleError } = await db
      .from("user_roles")
      .upsert({ user_id: context.userId, tenant_id: invite.tenant_id, role: invite.role }, { onConflict: "user_id,tenant_id,role" });
    if (roleError) throw new Error("Could not join the workspace");
    await db.from("profiles").update({ tenant_id: invite.tenant_id }).eq("id", context.userId);
    await db.from("tenant_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    return { ok: true, tenantId: invite.tenant_id };
  });
