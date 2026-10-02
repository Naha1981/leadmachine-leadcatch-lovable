import { createFileRoute } from "@tanstack/react-router";
import { MARKET_INTELLIGENCE_CATEGORIES, MARKET_INTELLIGENCE_LIMITS } from "@/lib/market-intelligence.constants";

export const Route = createFileRoute("/api/market-intelligence")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: user, error: userError } = await db.auth.getUser(token);
        if (userError || !user?.user) return new Response("Unauthorized", { status: 401 });
        const { data: profile } = await db.from("profiles").select("tenant_id").eq("id", user.user.id).maybeSingle();
        if (!profile?.tenant_id) return new Response("Unauthorized", { status: 401 });

        const tenantId = profile.tenant_id;
        const [{ data: platform }, { data: business }, { data: signals, error }, { data: latestRun }, { count: evidenceCount }] = await Promise.all([
          db.from("market_intelligence_platform_settings").select("enabled").eq("id", true).maybeSingle(),
          db.from("business_profiles").select("market_intelligence_enabled").eq("tenant_id", tenantId).maybeSingle(),
          db.from("market_intelligence_signals").select("*").eq("tenant_id", tenantId).eq("status", "active").order("last_observed_at", { ascending: false }).limit(150),
          db.from("market_intelligence_runs").select("completed_at,status").eq("tenant_id", tenantId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
          db.from("market_intelligence_evidence").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        ]);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        const enabled = platform?.enabled !== false && business?.market_intelligence_enabled !== false;
        const active = enabled ? (signals ?? []).filter((signal: any) => !signal.expires_at || new Date(signal.expires_at).getTime() > Date.now()) : [];
        active.sort((a: any, b: any) => (Number(b.freshness_score) * .35 + Number(b.confidence) * .35 + Number(b.relevance_score) * .3) - (Number(a.freshness_score) * .35 + Number(a.confidence) * .35 + Number(a.relevance_score) * .3));
        const categories: Record<string, any[]> = Object.fromEntries(MARKET_INTELLIGENCE_CATEGORIES.map((category) => [category, []]));
        for (const category of MARKET_INTELLIGENCE_CATEGORIES) categories[category] = active.filter((signal: any) => signal.category === category).slice(0, MARKET_INTELLIGENCE_LIMITS[category]);
        const ids = active.slice(0, 60).map((signal: any) => signal.id);
        let evidence: any[] = [];
        if (ids.length) {
          const result = await db.from("market_intelligence_evidence").select("*").eq("tenant_id", tenantId).in("signal_id", ids).order("discovered_at", { ascending: false }).limit(300);
          evidence = result.data ?? [];
        }
        for (const [category, list] of Object.entries(categories)) categories[category] = list.map((signal: any) => ({ ...signal, evidence: evidence.filter((item) => item.signal_id === signal.id).slice(0, 6) }));
        return Response.json({ ok: true, enabled, updatedAt: latestRun?.completed_at ?? null, categories, stats: { totalActive: active.length, evidenceCount: evidenceCount ?? 0, lastRunAt: latestRun?.completed_at ?? null } });
      },
    },
  },
});
