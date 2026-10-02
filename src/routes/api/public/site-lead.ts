import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { scoreInboundLead } from "@/lib/lead-scoring.server";
import { getE2EBusiness, isE2EEnabled, recordQuoteLead } from "@/lib/e2e-store.server";

const Body = z.object({
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(9).max(20),
  message: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true),
});

type RateBucket = { count: number; resetAt: number };

const leadRateBuckets = new Map<string, RateBucket>();
const LEAD_RATE_WINDOW_MS = 60_000;
const LEAD_RATE_LIMIT = 12;

function requestClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

function allowLeadSubmission(request: Request, slug: string): boolean {
  const key = `site-lead:${slug}:${requestClientKey(request)}`;
  const now = Date.now();
  const current = leadRateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    leadRateBuckets.set(key, { count: 1, resetAt: now + LEAD_RATE_WINDOW_MS });
    return true;
  }

  if (current.count >= LEAD_RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function pruneLeadRateBuckets(now = Date.now()): void {
  for (const [key, bucket] of leadRateBuckets) {
    if (bucket.resetAt <= now) leadRateBuckets.delete(key);
  }
  if (leadRateBuckets.size > 5000) {
    const oldest = [...leadRateBuckets.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
      .slice(0, 1000);
    for (const [key] of oldest) leadRateBuckets.delete(key);
  }
}

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
        pruneLeadRateBuckets();
        if (!allowLeadSubmission(request, parsed.slug)) {
          return Response.json(
            { ok: false, error: "Too many enquiries from this connection. Please try again shortly." },
            { status: 429, headers: { "Retry-After": "60" } },
          );
        }

        const phone = normalisePhone(parsed.phone);
        if (!phone) return Response.json({ ok: false, error: "That phone number doesn't look right." }, { status: 400 });

        if (isE2EEnabled() && parsed.slug.toLowerCase() === "e2e-leadmachine") {
          const business = getE2EBusiness();
          const scored = await scoreInboundLead({
            businessName: business.businessName,
            industry: business.industry,
            services: business.services,
            leadName: parsed.name,
            phone,
            message: parsed.message || "",
          });
          recordQuoteLead({
            name: parsed.name,
            phone,
            score: scored.score,
            temperature: scored.temperature,
            summary: scored.summary,
          });
          return Response.json({
            ok: true,
            leadId: "e2e-quote-lead",
            score: scored.score,
            temperature: scored.temperature,
            e2e: true,
          });
        }

        const { supabaseAdmin: rawDb } = await import("@/integrations/supabase/client.server");
        const db = rawDb as any;
        const { data: site, error: siteError } = await db
          .from("websites")
          .select("tenant_id")
          .eq("slug", parsed.slug)
          .eq("published", true)
          .maybeSingle();
        if (siteError) {
          console.error("site lookup failed", siteError);
          return Response.json({ ok: false, error: "We couldn't process this enquiry right now." }, { status: 503 });
        }
        if (!site) return Response.json({ ok: false, error: "This page is not available." }, { status: 404 });

        const tenantId = site.tenant_id;
        const { data: profile, error: profileError } = await db
          .from("business_profiles")
          .select("business_name, industry, services")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (profileError) {
          console.error("business profile lookup failed", profileError);
          return Response.json({ ok: false, error: "We couldn't process this enquiry right now." }, { status: 503 });
        }

        const { data: existing, error: existingError } = await db
          .from("leads")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("phone", phone)
          .maybeSingle();
        if (existingError) {
          console.error("existing lead lookup failed", existingError);
          return Response.json({ ok: false, error: "We couldn't process this enquiry right now." }, { status: 503 });
        }

        const scored = await scoreInboundLead({
          businessName: profile?.business_name || "Your business",
          industry: profile?.industry || "",
          services: profile?.services || "",
          leadName: parsed.name,
          phone,
          message: parsed.message || "",
        });

        let leadId = existing?.id;
        if (!leadId) {
          const r = await db
            .from("leads")
            .insert({
              tenant_id: tenantId,
              phone,
              name: parsed.name,
              source: "website",
              ai_score: scored.score,
              ai_temperature: scored.temperature,
              ai_summary: scored.summary,
              ai_scored_at: new Date().toISOString(),
              ai_last_scored_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (r.error) {
            console.error("site lead insert failed", r.error);
            return Response.json({ ok: false, error: "We couldn't save your details. Please try again." }, { status: 500 });
          }
          leadId = r.data.id;
        } else {
          const updateResult = await db.from("leads").update({
            name: parsed.name,
            status: "new",
            ai_score: scored.score,
            ai_temperature: scored.temperature,
            ai_summary: scored.summary,
            ai_scored_at: new Date().toISOString(),
            ai_last_scored_message_at: new Date().toISOString(),
          }).eq("id", leadId);

          if (updateResult.error) {
            console.error("existing lead update failed", updateResult.error);
            return Response.json({ ok: false, error: "We couldn't save your details. Please try again." }, { status: 500 });
          }
        }

        if (parsed.message) {
          const messageResult = await db.from("conversation_messages").insert({
            tenant_id: tenantId,
            lead_id: leadId,
            direction: "inbound",
            body: parsed.message,
            sender: "customer",
            delivery_status: "received",
          });
          if (messageResult.error) {
            console.error("conversation message insert failed", messageResult.error);
          }
        }

        const createdEvent = await db.from("lead_events").insert({
          tenant_id: tenantId,
          lead_id: leadId,
          type: "lead_created",
          payload: { source: "website", slug: parsed.slug, consent: true },
        });
        if (createdEvent.error) {
          console.error("lead_created event insert failed", createdEvent.error);
        }

        const scoredEvent = await db.from("lead_events").insert({
          tenant_id: tenantId,
          lead_id: leadId,
          type: "lead_scored",
          payload: { score: scored.score, temperature: scored.temperature, summary: scored.summary },
        });
        if (scoredEvent.error) {
          console.error("lead_scored event insert failed", scoredEvent.error);
        }

        return Response.json({
          ok: true,
          leadId,
          score: scored.score,
          temperature: scored.temperature,
        });
      },
    },
  },
});
