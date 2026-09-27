import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(9).max(20),
  message: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true),
});

function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("27") && digits.length === 11) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `27${digits.slice(1)}`;
  if (digits.length >= 9 && digits.length <= 15) return digits;
  return null;
}

export const Route = createFileRoute("/api/public/site-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "Please check the form and try again." }, { status: 400 });
        }
        const phone = normalisePhone(parsed.phone);
        if (!phone) return Response.json({ ok: false, error: "That phone number doesn't look right." }, { status: 400 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: site } = await db
          .from("websites")
          .select("tenant_id")
          .eq("slug", parsed.slug)
          .eq("published", true)
          .maybeSingle();
        if (!site) return Response.json({ ok: false, error: "This page is not available." }, { status: 404 });

        const tenantId = site.tenant_id;
        const { data: existing } = await db.from("leads").select("id").eq("tenant_id", tenantId).eq("phone", phone).maybeSingle();

        let leadId = existing?.id;
        if (!leadId) {
          const r = await db
            .from("leads")
            .insert({ tenant_id: tenantId, phone, name: parsed.name, source: "website" })
            .select("id")
            .single();
          if (r.error) {
            console.error("site lead insert failed", r.error);
            return Response.json({ ok: false, error: "We couldn't save your details. Please try again." }, { status: 500 });
          }
          leadId = r.data.id;
        } else {
          await db.from("leads").update({ name: parsed.name, status: "new" }).eq("id", leadId);
        }

        if (parsed.message) {
          await db.from("conversation_messages").insert({
            tenant_id: tenantId,
            lead_id: leadId,
            direction: "inbound",
            body: parsed.message,
            sender: "customer",
            delivery_status: "received",
          });
        }
        await db.from("lead_events").insert({
          tenant_id: tenantId,
          lead_id: leadId,
          type: "lead_created",
          payload: { source: "website", slug: parsed.slug, consent: true },
        });

        return Response.json({ ok: true });
      },
    },
  },
});
