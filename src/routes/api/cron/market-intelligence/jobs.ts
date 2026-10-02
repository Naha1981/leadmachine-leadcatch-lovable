import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/market-intelligence/jobs")({
  server: { handlers: {
    GET: async ({ request }) => {
      const expected = process.env["MARKET_INTELLIGENCE_CRON_SECRET"] || process.env["CRON_SECRET"];
      if (!expected || request.headers.get("authorization") !== "Bearer " + expected) return new Response("Unauthorized", { status: 401 });
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { data, error } = await db.from("business_profiles").select("tenant_id,business_name,industry,services,suburb,market_intelligence_enabled,market_intelligence_website,market_intelligence_keywords").eq("market_intelligence_enabled", true).limit(100);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      const jobs = [];
      for (const profile of data ?? []) {
        const competitors = await db.from("market_intelligence_competitors").select("website_url").eq("tenant_id", profile.tenant_id).eq("status", "active").limit(10);
        const services = String(profile.services ?? "").split(/[,|\n]/).map((v) => v.trim()).filter(Boolean).slice(0, 8);
        const keywords = Array.isArray(profile.market_intelligence_keywords) ? profile.market_intelligence_keywords.map(String).slice(0, 15) : [];
        const queries = Array.from(new Set([profile.industry, ...services, ...keywords].map((v) => String(v ?? "").trim()).filter(Boolean))).slice(0, 10).map((query) => query + (profile.suburb ? " " + profile.suburb : ""));
        jobs.push({ tenantId: profile.tenant_id, businessName: profile.business_name, queries, website: profile.market_intelligence_website || null, competitorUrls: (competitors.data ?? []).map((item: any) => item.website_url).filter(Boolean).slice(0, 10) });
      }
      return Response.json({ ok: true, jobs });
    },
  }},
});
