import { createFileRoute } from "@tanstack/react-router";
import { getWhatsAppPresenceReport, monitorWhatsAppPresence } from "@/lib/operator.server";
import { normalizePhoneNumber } from "@/lib/zero-ui-phone.server";

async function getTenantFromRequest(request: Request): Promise<{ tenantId: string; userId: string } | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: user, error: userError } = await db.auth.getUser(token);
  if (userError || !user?.user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.user.id)
    .maybeSingle();

  if (!profile?.tenant_id) return null;
  return { tenantId: profile.tenant_id, userId: user.user.id };
}

async function getLeadContext(db: any, tenantId: string, leadId: string) {
  const [{ data: lead, error: leadError }, { data: business, error: businessError }] = await Promise.all([
    db.from("leads").select("id,name,phone").eq("tenant_id", tenantId).eq("id", leadId).maybeSingle(),
    db.from("business_profiles").select("wa_account_id").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  if (leadError) throw leadError;
  if (businessError) throw businessError;
  if (!lead) throw new Error("Lead not found");
  if (!business?.wa_account_id) throw new Error("WhatsApp is not connected for this tenant");

  const phone = normalizePhoneNumber(lead.phone);
  if (!phone) throw new Error("Lead does not have a valid WhatsApp phone number");

  return { lead, waAccountId: String(business.wa_account_id), phone };
}

export const Route = createFileRoute("/api/whatsapp-presence")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getTenantFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        try {
          const body = await request.json();
          const leadId = String(body?.leadId ?? "").trim();
          if (!leadId) return Response.json({ ok: false, error: "leadId is required" }, { status: 400 });

          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const { lead, waAccountId, phone } = await getLeadContext(db, auth.tenantId, leadId);
          const result = await monitorWhatsAppPresence(
            auth.tenantId,
            waAccountId,
            phone,
            lead.name ? String(lead.name) : null,
          );

          return Response.json(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to start WhatsApp presence monitoring";
          return Response.json({ ok: false, error: message }, { status: 422 });
        }
      },

      GET: async ({ request }) => {
        const auth = await getTenantFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const leadId = url.searchParams.get("leadId")?.trim() ?? "";
        if (!leadId) return Response.json({ ok: false, error: "leadId is required" }, { status: 400 });

        const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
        const timezone = url.searchParams.get("timezone")?.trim() || "Africa/Johannesburg";

        try {
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const { lead, waAccountId, phone } = await getLeadContext(db, auth.tenantId, leadId);
          const report = await getWhatsAppPresenceReport(
            auth.tenantId,
            waAccountId,
            phone,
            Number.isFinite(days) ? Math.floor(days) : 30,
            timezone,
          );

          return Response.json({
            ok: true,
            lead: { id: lead.id, name: lead.name, phone: phone },
            report,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load WhatsApp presence report";
          return Response.json({ ok: false, error: message }, { status: 422 });
        }
      },
    },
  },
});
