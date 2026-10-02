import { createHash } from "node:crypto";
import type { MarketIntelligenceSourceType } from "@/lib/market-intelligence.constants";

export type MarketSourceDocument = {
  source: string;
  sourceType: MarketIntelligenceSourceType;
  sourceUrl: string;
  externalId?: string | null;
  title: string;
  author?: string | null;
  publishedAt?: string | null;
  evidenceText: string;
  metadata?: Record<string, unknown>;
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"' ).replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function safeFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "LeadMachine-MarketIntelligence/1.0",
        Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.8",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    console.error("[MarketIntelligence] fetch failed", url, error);
    return null;
  }
}

export async function readPublicWebPage(url: string, sourceType: MarketIntelligenceSourceType = "web"): Promise<MarketSourceDocument | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const jinaUrl = "https://r.jina.ai/" + url;
  const response = await safeFetch(jinaUrl, { headers: { Accept: "text/plain" } });
  if (!response?.ok) return null;
  const text = clean((await response.text()).slice(0, 12_000));
  if (!text) return null;
  return {
    source: sourceType === "competitor" ? "Competitor website" : "Public web",
    sourceType,
    sourceUrl: url,
    title: clean(text.split("\n")[0]).slice(0, 240) || url,
    evidenceText: text.slice(0, 5_000),
    metadata: { reader: "Jina Reader" },
  };
}

export async function searchPublicWeb(query: string, limit = 8): Promise<MarketSourceDocument[]> {
  const q = encodeURIComponent(query);
  const endpoints = [
    "https://www.bing.com/search?q=" + q + "&count=" + Math.min(limit, 10),
    "https://www.google.com/search?q=" + q + "&num=" + Math.min(limit, 10),
  ];
  for (const endpoint of endpoints) {
    const response = await safeFetch(endpoint);
    if (!response?.ok) continue;
    const html = await response.text();
    const docs: MarketSourceDocument[] = [];
    const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) && docs.length < limit) {
      const url = match[1];
      const rawTitle = match[2];
      if (!url || !rawTitle) continue;
      if (/bing\.com|google\.com|microsoft\.com|googleusercontent\.com/i.test(url)) continue;
      const title = decodeHtml(rawTitle.replace(/<[^>]+>/g, "")).trim();
      if (!title || title.length < 5) continue;
      docs.push({ source: "Web search", sourceType: "web", sourceUrl: url, title: title.slice(0, 240), evidenceText: title, metadata: { query } });
    }
    if (docs.length) return docs;
  }
  return [];
}

export async function collectDemandRadarEvidence(db: any, tenantId: string, sinceIso: string, limit = 40): Promise<MarketSourceDocument[]> {
  const { data, error } = await db
    .from("demand_radar_signals")
    .select("id, source_name, source_url, author, title, body, detected_at, service, suburb, urgency, intent_score")
    .eq("tenant_id", tenantId)
    .gte("detected_at", sinceIso)
    .order("detected_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[MarketIntelligence] Demand Radar read failed", error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    source: row.source_name || "Reddit",
    sourceType: "reddit",
    sourceUrl: row.source_url,
    externalId: "demand-radar:" + row.id,
    title: clean(row.title || row.service || "Demand signal"),
    author: row.author ?? null,
    publishedAt: row.detected_at ?? null,
    evidenceText: clean([row.body, row.service ? "Service: " + row.service : "", row.suburb ? "Area: " + row.suburb : "", row.urgency ? "Urgency: " + row.urgency : ""].filter(Boolean).join(" | ")),
    metadata: { demandRadar: true, intentScore: row.intent_score },
  }));
}

type AgentReachResponse = { documents?: MarketSourceDocument[] };
export async function collectAgentReachEvidence(input: { tenantId: string; queries: string[]; competitorUrls: string[] }): Promise<MarketSourceDocument[]> {
  const enabled = process.env["AGENT_REACH_ENABLED"] === "true";
  const baseUrl = process.env["AGENT_REACH_API_URL"];
  const apiKey = process.env["AGENT_REACH_API_KEY"];
  if (!enabled || !baseUrl) return [];
  try {
    const response = await fetch(baseUrl.replace(/\/$/, "") + "/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: "Bearer " + apiKey } : {}) },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.error("[MarketIntelligence] Agent Reach adapter returned", response.status);
      return [];
    }
    const payload = (await response.json()) as AgentReachResponse;
    return (payload.documents ?? []).filter((doc) => doc?.sourceUrl && doc?.evidenceText).slice(0, 80);
  } catch (error) {
    console.error("[MarketIntelligence] Agent Reach adapter failed", error);
    return [];
  }
}

export function evidenceHash(document: MarketSourceDocument, category: string): string {
  return createHash("sha256").update([category, document.sourceType, document.sourceUrl, document.externalId ?? "", document.title, document.evidenceText].join("\n")).digest("hex");
}

function domainOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

export async function discoverCompetitors(input: { businessName: string; industry: string; services: string; suburb: string | null; existingWebsite?: string | null }): Promise<Array<{ name: string; websiteUrl: string }>> {
  const query = [input.businessName + " competitors", input.industry, input.services, input.suburb].filter(Boolean).join(" ");
  const results = await searchPublicWeb(query, 10);
  const existingDomain = input.existingWebsite ? domainOf(input.existingWebsite) : null;
  const seen = new Set<string>();
  const competitors: Array<{ name: string; websiteUrl: string }> = [];
  for (const result of results) {
    const domain = domainOf(result.sourceUrl);
    if (!domain || domain === existingDomain) continue;
    if (/facebook\.com|instagram\.com|youtube\.com|reddit\.com|x\.com|twitter\.com/i.test(domain)) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    competitors.push({ name: result.title.slice(0, 120), websiteUrl: result.sourceUrl });
    if (competitors.length >= 5) break;
  }
  return competitors;
}

export async function collectInternalLeadEvidence(db: any, tenantId: string, sinceIso: string): Promise<MarketSourceDocument[]> {
  const { data, error } = await db
    .from("leads")
    .select("id,service,suburb,urgency,ai_temperature,created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data?.length) return [];
  const groups = new Map<string, { count: number; hot: number; urgency: number; latest: string | null; suburb: string | null }>();
  for (const lead of data as any[]) {
    const key = clean(lead.service || "General enquiry");
    const current = groups.get(key) ?? { count: 0, hot: 0, urgency: 0, latest: null, suburb: clean(lead.suburb) || null };
    current.count += 1;
    if (lead.ai_temperature === "hot") current.hot += 1;
    if (lead.urgency) current.urgency += 1;
    current.latest = current.latest && new Date(current.latest) > new Date(lead.created_at) ? current.latest : lead.created_at;
    groups.set(key, current);
  }
  return [...groups.entries()].sort((a,b) => b[1].count - a[1].count).slice(0, 8).map(([service, stats]) => ({
    source: "LeadMachine internal signals",
    sourceType: "internal",
    sourceUrl: "/inbox",
    externalId: "lead-summary:" + service.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: service + " internal demand pattern",
    publishedAt: stats.latest,
    evidenceText: stats.count + " enquiries in the recent period mention " + service + "; " + stats.hot + " are currently hot and " + stats.urgency + " include urgency data." + (stats.suburb ? " Recent activity includes " + stats.suburb + "." : ""),
    metadata: { internal: true, service, enquiryCount: stats.count, hotCount: stats.hot, urgencyCount: stats.urgency },
  }));
}