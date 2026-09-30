import { createFileRoute } from "@tanstack/react-router";
import { getE2EState, getE2EZeroUIState, isE2EEnabled, resetE2EState } from "@/lib/e2e-store.server";

function authorized(request: Request) {
  const secret = process.env["E2E_TEST_SECRET"];
  return Boolean(secret && request.headers.get("x-e2e-secret") === secret);
}

export const Route = createFileRoute("/api/test/acceptance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "Not found" }, { status: 404 });
        if (isE2EEnabled()) {
          resetE2EState();
          return Response.json({
            ok: true,
            tenantId: "00000000-0000-0000-0000-00000000e2e1",
            slug: "e2e-leadmachine",
            siteUrl: "/s/e2e-leadmachine",
            leakageLeadId: "e2e-leakage-lead",
            e2e: true,
          });
        }

        const { supabaseAdmin: rawDb } = await import("@/integrations/supabase/client.server");
        const db = rawDb as any;
        const slug = "e2e-leadmachine";

        let { data: tenant } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
        if (!tenant) {
          const created = await db.from("tenants").insert({
            name: "E2E Test Plumbing",
            slug,
            industry: "Plumber",
            onboarded: true,
          }).select("id").single();
          if (created.error) throw created.error;
          tenant = created.data;
        }

        await db.from("lead_leakage_alerts").delete().eq("tenant_id", tenant.id);
        await db.from("leads").delete().eq("tenant_id", tenant.id);

        await db.from("business_profiles").upsert({
          tenant_id: tenant.id,
          business_name: "E2E Test Plumbing",
          trade: "Plumber",
          industry: "Plumber",
          services: "Emergency plumbing\nLeak detection and repairs\nBlocked drains\nGeyser repairs",
          contact_phone: "+27825550111",
          whatsapp_number: "+27825550111",
          whatsapp_status: "connected",
          wa_account_id: "e2e-account",
          working_hours: { days: [1,2,3,4,5], start: "08:00", end: "17:00" },
          onboarded: true,
        }, { onConflict: "tenant_id" });

        await db.from("auto_reply_configs").upsert({
          tenant_id: tenant.id,
          enabled: true,
          greeting: "Hi! Thanks for contacting E2E Test Plumbing. We’ll help you right away.",
          questions: ["What plumbing problem do you need help with?","Which suburb are you in?","How urgent is it — now, today, or later?"],
          keyword_rules: [],
          after_hours: "Thanks for your message. We’re closed right now and will reply first thing tomorrow.",
          handoff: "Thanks! One of our team will reply to you shortly.",
        }, { onConflict: "tenant_id" });

        await db.from("websites").upsert({
          tenant_id: tenant.id,
          slug,
          published: true,
          headline: "E2E Test Plumbing",
          subheadline: "Fast plumbing help across Gauteng.",
          about: "A controlled test business page for automated acceptance tests.",
          services: [
            { name: "Emergency plumbing", description: "Fast help for urgent plumbing problems." },
            { name: "Geyser repairs", description: "Repairs for common geyser faults." },
          ],
          faqs: [{ q: "Do you handle emergencies?", a: "Yes. Send your suburb and the problem." }],
          cta_text: "Get a free quote on WhatsApp",
          accent: "emerald",
          whatsapp_number: "27825550111",
        }, { onConflict: "tenant_id" });

        await db.from("zero_ui_configs").upsert({
          tenant_id: tenant.id,
          enabled: true,
          automation_enabled: true,
          owner_alerts_enabled: true,
          auto_followups_enabled: true,
        }, { onConflict: "tenant_id" });

        const oldLead = await db.from("leads").insert({
          tenant_id: tenant.id,
          phone: "27825550999",
          name: "Leakage Test Lead",
          source: "e2e",
          status: "new",
          service: "Emergency plumbing",
          ai_score: 10,
          ai_temperature: "hot",
          ai_summary: "Urgent emergency plumbing enquiry.",
          created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
          last_message_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
        }).select("id").single();
        if (oldLead.error) throw oldLead.error;

        return Response.json({
          ok: true,
          tenantId: tenant.id,
          slug,
          siteUrl: `/s/${slug}`,
          leakageLeadId: oldLead.data.id,
        });
      },
      GET: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "Not found" }, { status: 404 });
        if (isE2EEnabled()) return Response.json({ ...getE2EState(), zeroUi: getE2EZeroUIState() });

        const { supabaseAdmin: rawDb } = await import("@/integrations/supabase/client.server");
        const db = rawDb as any;
        const { data: tenant } = await db.from("tenants").select("id").eq("slug", "e2e-leadmachine").maybeSingle();
        if (!tenant) return Response.json({ ok: false, error: "Fixture not seeded" }, { status: 404 });
        const [{ data: site }, { data: lead }, { data: alert }] = await Promise.all([
          db.from("websites").select("slug, published, tenant_id").eq("tenant_id", tenant.id).maybeSingle(),
          db.from("leads").select("id, name, phone, ai_score, ai_temperature, status").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          db.from("lead_leakage_alerts").select("lead_id, status, whatsapp_sent, sms_sent, alerted_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        return Response.json({ ok: true, site, lead, alert });
      },
    },
  },
});
