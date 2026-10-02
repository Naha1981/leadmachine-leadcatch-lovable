import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMarketIntelligenceAuth } from "@/lib/market-intelligence.auth.server";
import { MARKET_INTELLIGENCE_CATEGORIES, MARKET_INTELLIGENCE_LIMITS } from "@/lib/market-intelligence.constants";
import type { MarketIntelligenceSnapshot, MarketIntelligenceActionKind } from "@/lib/market-intelligence.types";

function rankSignals(signals: any[]) {
  return signals
    .filter((signal) => signal.status === "active" && (!signal.expires_at || new Date(signal.expires_at).getTime() > Date.now()))
    .sort((a, b) => {
      const scoreA = Number(a.freshness_score) * 0.35 + Number(a.confidence) * 0.35 + Number(a.relevance_score) * 0.3;
      const scoreB = Number(b.freshness_score) * 0.35 + Number(b.confidence) * 0.35 + Number(b.relevance_score) * 0.3;
      return scoreB - scoreA;
    });
}

async function tenantForUser(userId: string, db: any) {
  const { data, error } = await db.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  if (error || !data?.tenant_id) throw new Error("Workspace not found");
  return data.tenant_id as string;
}

export const getMarketIntelligence = createServerFn({ method: "GET" })
  .middleware([requireMarketIntelligenceAuth])
  .handler(async ({ context }): Promise<MarketIntelligenceSnapshot> => {
    if (process.env["E2E_MODE"] === "true") {
      const { buildE2EMarketIntelligence } = await import("@/lib/e2e-market-intelligence");
      return buildE2EMarketIntelligence();
    }
    const tenantId = await tenantForUser(context.userId, context.supabase);
    const [{ data: platform }, { data: profile }, { data: signals, error: signalError }, { data: latestRun }, { count: evidenceCount }] = await Promise.all([
      context.supabase.from("market_intelligence_platform_settings").select("enabled").eq("id", true).maybeSingle(),
      context.supabase.from("business_profiles").select("market_intelligence_enabled").eq("tenant_id", tenantId).maybeSingle(),
      context.supabase.from("market_intelligence_signals").select("*").eq("tenant_id", tenantId).eq("status", "active").order("last_observed_at", { ascending: false }).limit(150),
      context.supabase.from("market_intelligence_runs").select("started_at,completed_at,status").eq("tenant_id", tenantId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      context.supabase.from("market_intelligence_evidence").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    ]);
    if (signalError) throw signalError;
    const enabled = platform?.enabled !== false && profile?.market_intelligence_enabled !== false;
    const ranked = rankSignals(signals ?? []);
    const categories: Record<string, any[]> = Object.fromEntries(MARKET_INTELLIGENCE_CATEGORIES.map((category) => [category, []]));
    for (const category of MARKET_INTELLIGENCE_CATEGORIES) {
      categories[category] = ranked.filter((signal) => signal.category === category).slice(0, MARKET_INTELLIGENCE_LIMITS[category]);
    }
    if (!enabled) return { enabled: false, updatedAt: latestRun?.completed_at ?? null, categories, stats: { totalActive: 0, evidenceCount: 0, lastRunAt: latestRun?.completed_at ?? null } };
    const signalIds = ranked.slice(0, 60).map((signal) => signal.id);
    let evidence: any[] = [];
    if (signalIds.length) {
      const { data } = await context.supabase.from("market_intelligence_evidence").select("*").in("signal_id", signalIds).order("discovered_at", { ascending: false }).limit(300);
      evidence = data ?? [];
    }
    for (const category of MARKET_INTELLIGENCE_CATEGORIES) {
      categories[category] = categories[category].map((signal) => ({
        id: signal.id,
        category: signal.category,
        title: signal.title,
        summary: signal.summary,
        observedClaim: signal.observed_claim,
        inference: signal.inference,
        recommendedAction: signal.recommended_action,
        confidence: Number(signal.confidence),
        evidenceStrength: signal.evidence_strength,
        recurrenceCount: signal.recurrence_count,
        sourceDiversity: signal.source_diversity,
        relevanceScore: Number(signal.relevance_score),
        freshnessScore: Number(signal.freshness_score),
        status: signal.status,
        firstObservedAt: signal.first_observed_at,
        lastObservedAt: signal.last_observed_at,
        expiresAt: signal.expires_at,
        evidence: evidence.filter((item) => item.signal_id === signal.id).slice(0, 6).map((item) => ({
          id: item.id, source: item.source, sourceType: item.source_type, sourceUrl: item.source_url, externalId: item.external_id, title: item.title, author: item.author, publishedAt: item.published_at, discoveredAt: item.discovered_at, evidenceText: item.evidence_text, sourceMetadata: item.source_metadata,
        })),
      }));
    }
    const totalActive = Object.values(categories).reduce((sum, list) => sum + list.length, 0);
    return { enabled, updatedAt: latestRun?.completed_at ?? null, categories, stats: { totalActive, evidenceCount: evidenceCount ?? 0, lastRunAt: latestRun?.completed_at ?? null } };
  });

export const createMarketIntelligenceAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ signalId: z.string().uuid(), kind: z.enum(["FAQ","OFFER","WHATSAPP_RESPONSE","COMPETITOR_ANALYSIS","COUNTER_OFFER","LANDING_PAGE_BRIEF","ARTICLE","AUTO_REPLY_SNIPPET","CONTENT_POST","CAMPAIGN_BRIEF","LEAD_FORM","WHATSAPP_CAMPAIGN"]) }).parse(input))
  .handler(async ({ context, data }) => {
    if (process.env["E2E_MODE"] === "true") {
      return { kind: data.kind, draft: "E2E owner-reviewable draft for " + data.kind + ". No external action was executed." };
    }
    const tenantId = await tenantForUser(context.userId, context.supabase);
    const kind = data.kind as MarketIntelligenceActionKind;
    const { data: signal, error } = await context.supabase.from("market_intelligence_signals").select("id,tenant_id,category,title,observed_claim,inference,recommended_action").eq("id", data.signalId).eq("tenant_id", tenantId).single();
    if (error || !signal) throw new Error("Market Intelligence finding not found");
    const { data: evidence } = await context.supabase.from("market_intelligence_evidence").select("title,source_type,source_url,evidence_text").eq("signal_id", signal.id).eq("tenant_id", tenantId).order("discovered_at", { ascending: false }).limit(6);
    const input = { kind, title: signal.title, category: signal.category, observedClaim: signal.observed_claim, inference: signal.inference, recommendedAction: signal.recommended_action, evidence: evidence ?? [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const idempotencyKey = "mi-draft:" + signal.id + ":" + kind + ":" + Date.now();
    const { data: action, error: actionError } = await supabaseAdmin.from("zero_ui_agent_actions").insert({ tenant_id: tenantId, action: "market_intelligence_draft", action_class: "approval_required", target_type: "market_intelligence_signal", target_id: signal.id, idempotency_key: idempotencyKey, input, status: "processing" }).select("id").maybeSingle();
    if (actionError || !action?.id) throw new Error(actionError?.message || "Could not create action record");
    const draft = await draftAction(kind, input);
    await supabaseAdmin.from("zero_ui_agent_actions").update({ status: "completed", result: { draft }, completed_at: new Date().toISOString() }).eq("id", action.id).eq("tenant_id", tenantId);
    await supabaseAdmin.from("zero_ui_action_receipts").insert({ tenant_id: tenantId, agent_action_id: action.id, step: "draft", provider: "lovable-ai", status: "completed", output_summary: { kind, draft: String(draft).slice(0, 1200) } });
    await supabaseAdmin.from("zero_ui_audit_logs").insert({ tenant_id: tenantId, actor_type: "user", actor_id: context.userId, action: "market_intelligence_draft_created", target_type: "market_intelligence_signal", target_id: signal.id, result: "success", metadata: { kind } });
    return { kind, draft };
  });

async function draftAction(kind: MarketIntelligenceActionKind, input: any): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return "Draft unavailable because AI is not configured. Review the evidence and use the recommended action manually."; 
  const prompt = "Create a safe, owner-reviewable draft for a South African business. Do not claim unsupported facts. Do not publish or send anything. Action: " + kind + "\nFinding: " + input.title + "\nObserved: " + input.observedClaim + "\nInference: " + input.inference + "\nEvidence: " + JSON.stringify(input.evidence).slice(0, 7000);
  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env["MARKET_INTELLIGENCE_MODEL"] || "openai/gpt-6-astra", input: [{ role: "system", content: "Return only the draft text. South African English. Keep it practical." }, { role: "user", content: prompt }], stream: false, store: false, reasoning: { effort: "low", summary: "auto" } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return "AI draft unavailable right now. Review the evidence and recommended action."; 
  const body = await response.json() as any;
  return String(body.output_text || body.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === "output_text")?.text || "AI draft unavailable right now.").trim().slice(0, 5000);
}