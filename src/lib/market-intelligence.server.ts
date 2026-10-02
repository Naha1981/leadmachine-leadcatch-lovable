import { MARKET_INTELLIGENCE_CATEGORIES, MARKET_INTELLIGENCE_EXPIRY_DAYS, MARKET_INTELLIGENCE_LIMITS, type MarketIntelligenceCategory } from "@/lib/market-intelligence.constants";
import { collectDemandRadarEvidence, collectInternalLeadEvidence, discoverCompetitors, evidenceHash, readPublicWebPage, type MarketSourceDocument } from "@/lib/market-intelligence.sources.server";
import { synthesizeFindings } from "@/lib/market-intelligence.llm.server";

type TenantContext = {
  tenantId: string;
  businessName: string;
  industry: string;
  services: string;
  suburb: string | null;
  website: string | null;
  keywords: string[];
};

type Candidate = {
  tenantId: string;
  category: MarketIntelligenceCategory;
  clusterKey: string;
  relevance: number;
  document: MarketSourceDocument;
};

const STOP = new Set(["the","and","for","with","from","this","that","are","you","your","have","has","was","were","what","when","where","which","how","why","can","could","would","should","into","about","just","more","very","need","looking","service","services","business","customer","customers","local","near","today","please","help"]);
const PROBLEM_TERMS = /problem|issue|broken|repair|repairing|slow|delay|expensive|price|pricing|cost|quote|wait|waiting|poor|bad|frustrat|confus|difficult|cannot|can\x27t|failed|failure|leak|damage|urgent|emergency/i;
const QUESTION_TERMS = /\?|\bhow much\b|\bhow long\b|\bwhere can\b|\bwho can\b|\bdo you\b|\bcan you\b|\bis there\b|\bwhat does\b|\bwhich\b/i;
const LEAD_TERMS = /looking for|recommend|need (a|an|someone|help)|quote|price|available|today|urgent|emergency|book|call me/i;

function clean(value: unknown): string { return String(value ?? "").replace(/\s+/g, " ").trim(); }

function tokenise(text: string): string[] {
  return clean(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !STOP.has(token));
}

function clusterKey(category: MarketIntelligenceCategory, text: string, services: string): string {
  const serviceTokens = tokenise(services).slice(0, 3);
  const topic = tokenise(text).filter((token) => !serviceTokens.includes(token)).slice(0, 6);
  const key = [...serviceTokens, ...topic].join("-").slice(0, 140);
  return (category + ":" + (key || "general")).replace(/[^a-z0-9:_-]/g, "").slice(0, 160);
}

export function deterministicCategory(document: MarketSourceDocument): MarketIntelligenceCategory[] {
  const text = document.title + " " + document.evidenceText;
  const result = new Set<MarketIntelligenceCategory>();
  if (PROBLEM_TERMS.test(text)) result.add("CUSTOMER_PROBLEMS");
  if (QUESTION_TERMS.test(text)) {
    result.add("UNANSWERED_QUESTIONS");
    result.add("CONTENT_OPPORTUNITIES");
  }
  if (document.sourceType === "competitor" || /competitor|alternative|vs\b|pricing plans|packages/i.test(text)) result.add("COMPETITOR_OPPORTUNITIES");
  if (LEAD_TERMS.test(text) || document.sourceType === "reddit") result.add("LEAD_GENERATION_OPPORTUNITIES");
  if (!result.size) result.add("CONTENT_OPPORTUNITIES");
  return [...result];
}

export function scoreEvidence(input: { recurrenceCount: number; sourceDiversity: number; relevance: number; freshness: number; }): { confidence: number; evidenceStrength: "insufficient" | "weak" | "medium" | "high" } {
  const recurrence = Math.min(1, input.recurrenceCount / 5);
  const diversity = Math.min(1, input.sourceDiversity / 3);
  const rawConfidence = Math.min(0.98, 0.25 * recurrence + 0.25 * diversity + 0.3 * input.relevance + 0.2 * input.freshness);
  const confidence = Number((input.recurrenceCount < 2 ? Math.min(0.35, rawConfidence) : rawConfidence).toFixed(4));
  let evidenceStrength: "insufficient" | "weak" | "medium" | "high" = "weak";
  if (input.recurrenceCount < 2) evidenceStrength = "insufficient";
  else if (input.recurrenceCount >= 4 && input.sourceDiversity >= 3 && confidence >= 0.72) evidenceStrength = "high";
  else if (input.recurrenceCount >= 2 && input.sourceDiversity >= 2 && confidence >= 0.48) evidenceStrength = "medium";
  return { confidence, evidenceStrength };
}

export function freshnessScore(date: Date, now = new Date(), expiryDays = 14): number {
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
  return Number(Math.max(0, 1 - ageDays / expiryDays).toFixed(4));
}

export function selectTopSignals<T extends { category: string; lastObservedAt: string; freshnessScore: number; confidence: number; relevanceScore: number }>(signals: T[]): Record<string, T[]> {
  const output: Record<string, T[]> = Object.fromEntries(MARKET_INTELLIGENCE_CATEGORIES.map((category) => [category, []]));
  for (const category of MARKET_INTELLIGENCE_CATEGORIES) {
    output[category] = signals
      .filter((signal) => signal.category === category)
      .filter((signal) => new Date(signal.lastObservedAt).getTime() >= Date.now() - MARKET_INTELLIGENCE_EXPIRY_DAYS[category] * 86_400_000)
      .sort((a, b) => {
        const scoreA = a.freshnessScore * 0.35 + a.confidence * 0.35 + a.relevanceScore * 0.3;
        const scoreB = b.freshnessScore * 0.35 + b.confidence * 0.35 + b.relevanceScore * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, MARKET_INTELLIGENCE_LIMITS[category]);
  }
  return output;
}

function candidateRelevance(document: MarketSourceDocument, tenant: TenantContext): number {
  const text = (document.title + " " + document.evidenceText).toLowerCase();
  const terms = [tenant.businessName, tenant.industry, tenant.services, tenant.suburb ?? "", ...tenant.keywords]
    .flatMap(tokenise)
    .slice(0, 30);
  if (!terms.length) return 0.45;
  const matches = terms.filter((term) => text.includes(term)).length;
  return Math.min(1, 0.35 + matches / Math.min(10, terms.length));
}

function deterministicDraft(group: { clusterKey: string; category: MarketIntelligenceCategory; evidence: Candidate[] }) {
  const first = group.evidence[0]?.document;
  const title = clean(first?.title || group.clusterKey.replace(/[:_-]+/g, " ")).slice(0, 180);
  const observed = group.evidence.length + " public evidence item" + (group.evidence.length === 1 ? "" : "s") + " support this theme.";
  return { clusterKey: group.clusterKey, title, summary: observed, observedClaim: observed, inference: "The evidence may indicate a recurring market theme; more independent evidence increases confidence.", recommendedAction: "Review the linked evidence and decide on a customer-facing response." };
}

export async function processMarketIntelligence(limit = 25, mode: "regular" | "daily" = "regular") {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const platform = await db.from("market_intelligence_platform_settings").select("enabled").eq("id", true).maybeSingle();
  if (platform.error || platform.data?.enabled === false) return { status: "disabled", tenants: 0, documents: 0, signals: 0, duplicates: 0, failures: 0 };
  const { data: tenants, error: tenantError } = await db.from("business_profiles").select("tenant_id,business_name,industry,services,suburb,market_intelligence_enabled,market_intelligence_website,market_intelligence_keywords").eq("market_intelligence_enabled", true).limit(limit);
  if (tenantError) throw tenantError;

  let documentsCount = 0;
  let signalsCount = 0;
  let duplicates = 0;
  let failures = 0;

  for (const rawTenant of tenants ?? []) {
    const tenant: TenantContext = {
      tenantId: rawTenant.tenant_id,
      businessName: clean(rawTenant.business_name),
      industry: clean(rawTenant.industry),
      services: clean(rawTenant.services),
      suburb: clean(rawTenant.suburb) || null,
      website: clean(rawTenant.market_intelligence_website) || null,
      keywords: Array.isArray(rawTenant.market_intelligence_keywords) ? rawTenant.market_intelligence_keywords.map(String).slice(0, 15) : [],
    };
    const run = await db.from("market_intelligence_runs").insert({ tenant_id: tenant.tenantId, mode, status: "processing" }).select("id").maybeSingle();
    const runId = run.data?.id;
    try {
      const nowIso = new Date().toISOString();
      await db.from("market_intelligence_signals").update({ status: "archived", updated_at: nowIso }).eq("tenant_id", tenant.tenantId).eq("status", "active").lt("expires_at", nowIso);
      const since = new Date(Date.now() - (mode === "daily" ? 14 : 4) * 86_400_000).toISOString();
      const docs: MarketSourceDocument[] = [];
      const { data: rawDocuments } = await db.from("market_intelligence_documents").select("id,source,source_type,source_url,external_id,title,author,published_at,discovered_at,content,metadata").eq("tenant_id", tenant.tenantId).eq("status", "new").order("discovered_at", { ascending: false }).limit(80);
      const rawDocumentIds = (rawDocuments ?? []).map((row: any) => row.id);
      docs.push(...(rawDocuments ?? []).map((row: any) => ({ source: row.source, sourceType: row.source_type, sourceUrl: row.source_url, externalId: row.external_id, title: row.title, author: row.author, publishedAt: row.published_at || row.discovered_at, evidenceText: row.content, metadata: row.metadata || {} })));
      docs.push(...await collectDemandRadarEvidence(db, tenant.tenantId, since));
      docs.push(...await collectInternalLeadEvidence(db, tenant.tenantId, since));
      if (tenant.website) { const websiteDoc = await readPublicWebPage(tenant.website, "website"); if (websiteDoc) docs.push(websiteDoc); }

      const existingCompetitors = await db.from("market_intelligence_competitors").select("name,website_url").eq("tenant_id", tenant.tenantId).eq("status","active").limit(10);
      const discovered = await discoverCompetitors({ businessName: tenant.businessName, industry: tenant.industry, services: tenant.services, suburb: tenant.suburb, existingWebsite: tenant.website });
      for (const competitor of discovered) {
        await db.from("market_intelligence_competitors").upsert({ tenant_id: tenant.tenantId, name: competitor.name, website_url: competitor.websiteUrl, source: "auto_discovered", last_checked_at: new Date().toISOString() }, { onConflict: "tenant_id,website_url" });
      }
      const competitors = [...(existingCompetitors.data ?? []), ...discovered].slice(0, 8);
      for (const competitor of competitors) {
        const doc = await readPublicWebPage(competitor.website_url, "competitor");
        if (doc) docs.push({ ...doc, source: competitor.name, sourceType: "competitor", title: competitor.name + " — " + doc.title });
      }

      documentsCount += docs.length;
      const grouped = new Map<string, { clusterKey: string; category: MarketIntelligenceCategory; evidence: Candidate[] }>();
      for (const document of docs) {
        for (const category of deterministicCategory(document)) {
          const key = clusterKey(category, document.title + " " + document.evidenceText, tenant.services);
          const candidate: Candidate = { tenantId: tenant.tenantId, category, clusterKey: key, relevance: candidateRelevance(document, tenant), document };
          const groupKey = category + "|" + key;
          const group = grouped.get(groupKey) ?? { clusterKey: key, category, evidence: [] };
          if (group.evidence.length < 8) group.evidence.push(candidate);
          grouped.set(groupKey, group);
        }
      }

      const groups = [...grouped.values()].slice(0, 30);
      const llmDrafts = await synthesizeFindings(groups.map((group) => ({ clusterKey: group.clusterKey, category: group.category, evidence: group.evidence.map((item) => ({ title: item.document.title, sourceType: item.document.sourceType, sourceUrl: item.document.sourceUrl, text: item.document.evidenceText })) })));
      const draftsByKey = new Map(llmDrafts.map((draft) => [draft.clusterKey, draft]));

      for (const group of groups) {
        const hasExternalEvidence = group.evidence.some((item) => item.document.sourceType !== "internal");
        if (!hasExternalEvidence) continue;
        const now = new Date();
        const latest = group.evidence.map((item) => item.document.publishedAt || null).filter(Boolean).map((value) => new Date(value as string)).sort((a,b) => b.getTime()-a.getTime())[0] ?? now;
        const recurrence = new Set(group.evidence.map((item) => item.document.externalId || item.document.sourceUrl)).size;
        const diversity = new Set(group.evidence.map((item) => item.document.sourceType)).size;
        const relevance = group.evidence.reduce((sum, item) => sum + item.relevance, 0) / Math.max(1, group.evidence.length);
        const freshness = freshnessScore(latest, now, MARKET_INTELLIGENCE_EXPIRY_DAYS[group.category]);
        const scored = scoreEvidence({ recurrenceCount: recurrence, sourceDiversity: diversity, relevance, freshness });
        const draft = draftsByKey.get(group.clusterKey) ?? deterministicDraft(group);
        const expiresAt = new Date(now.getTime() + MARKET_INTELLIGENCE_EXPIRY_DAYS[group.category] * 86_400_000).toISOString();
        const { data: existingSignal } = await db.from("market_intelligence_signals")
          .select("id,first_observed_at,last_observed_at")
          .eq("tenant_id", tenant.tenantId)
          .eq("category", group.category)
          .eq("cluster_key", group.clusterKey)
          .maybeSingle();
        const firstObservedAt = existingSignal?.first_observed_at || latest.toISOString();
        const previousLast = existingSignal?.last_observed_at ? new Date(existingSignal.last_observed_at).getTime() : 0;
        const latestObservedAt = new Date(Math.max(previousLast, latest.getTime())).toISOString();
        const upserted = await db.from("market_intelligence_signals").upsert({
          tenant_id: tenant.tenantId, category: group.category, cluster_key: group.clusterKey, title: draft.title, summary: draft.summary, observed_claim: draft.observedClaim, inference: draft.inference, recommended_action: draft.recommendedAction, confidence: scored.confidence, evidence_strength: scored.evidenceStrength, recurrence_count: recurrence, source_diversity: diversity, relevance_score: relevance, freshness_score: freshness, status: "active", first_observed_at: firstObservedAt, last_observed_at: latestObservedAt, expires_at: expiresAt, updated_at: now.toISOString()
        }, { onConflict: "tenant_id,category,cluster_key" }).select("id").maybeSingle();
        if (upserted.error || !upserted.data?.id) { failures += 1; console.error("[MarketIntelligence] signal upsert failed", upserted.error); continue; }
        signalsCount += 1;
        for (const item of group.evidence) {
          const inserted = await db.from("market_intelligence_evidence").insert({ tenant_id: tenant.tenantId, signal_id: upserted.data.id, source: item.document.source, source_type: item.document.sourceType, source_url: item.document.sourceUrl, external_id: item.document.externalId ?? null, title: item.document.title, author: item.document.author ?? null, published_at: item.document.publishedAt ?? null, evidence_text: item.document.evidenceText.slice(0, 5000), source_metadata: item.document.metadata ?? {}, evidence_hash: evidenceHash(item.document, group.category) });
          if (inserted.error?.code === "23505") { duplicates += 1; continue; }
          if (inserted.error) { failures += 1; console.error("[MarketIntelligence] evidence insert failed", inserted.error); }
        }
        const { data: evidenceTotals } = await db.from("market_intelligence_evidence")
          .select("source_type")
          .eq("tenant_id", tenant.tenantId)
          .eq("signal_id", upserted.data.id);
        const totalRecurrence = evidenceTotals?.length ?? recurrence;
        const totalDiversity = new Set((evidenceTotals ?? []).map((item: any) => item.source_type)).size || diversity;
        const recalculated = scoreEvidence({ recurrenceCount: totalRecurrence, sourceDiversity: totalDiversity, relevance, freshness });
        await db.from("market_intelligence_signals").update({
          recurrence_count: totalRecurrence,
          source_diversity: totalDiversity,
          confidence: recalculated.confidence,
          evidence_strength: recalculated.evidenceStrength,
          freshness_score: freshness,
          last_observed_at: latestObservedAt,
          expires_at: expiresAt,
          updated_at: now.toISOString(),
        }).eq("id", upserted.data.id).eq("tenant_id", tenant.tenantId);
      }
      if (rawDocumentIds.length) await db.from("market_intelligence_documents").update({ status: "processed", processed_at: new Date().toISOString() }).eq("tenant_id", tenant.tenantId).in("id", rawDocumentIds);
      if (runId) await db.from("market_intelligence_runs").update({ status: "completed", completed_at: new Date().toISOString(), documents_collected: docs.length, candidate_signals: groups.length, accepted_signals: groups.length, duplicates_removed: duplicates, failures }).eq("id", runId).eq("tenant_id", tenant.tenantId);
    } catch (error) {
      failures += 1;
      if (runId) await db.from("market_intelligence_runs").update({ status: "failed", completed_at: new Date().toISOString(), failures: 1, error: error instanceof Error ? error.message : "Market Intelligence tenant run failed" }).eq("id", runId).eq("tenant_id", tenant.tenantId);
      console.error("[MarketIntelligence] tenant failed", tenant.tenantId, error);
    }
  }
  return { status: "completed", tenants: (tenants ?? []).length, documents: documentsCount, signals: signalsCount, duplicates, failures };
}

export function topN<T>(items: T[], category: MarketIntelligenceCategory): T[] { return items.slice(0, MARKET_INTELLIGENCE_LIMITS[category]); }

export { clusterKey };
