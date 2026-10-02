import type { MarketIntelligenceSnapshot, MarketIntelligenceSignal } from "@/lib/market-intelligence.types";
import { MARKET_INTELLIGENCE_CATEGORIES } from "@/lib/market-intelligence.constants";

const counts: Record<string, number> = { CUSTOMER_PROBLEMS: 3, COMPETITOR_OPPORTUNITIES: 5, UNANSWERED_QUESTIONS: 7, CONTENT_OPPORTUNITIES: 4, LEAD_GENERATION_OPPORTUNITIES: 2 };

export function buildE2EMarketIntelligence(): MarketIntelligenceSnapshot {
  const categories: Record<string, MarketIntelligenceSignal[]> = {};
  for (const category of MARKET_INTELLIGENCE_CATEGORIES) {
    const total = counts[category];
    categories[category] = Array.from({ length: total }, (_, index) => {
      const id = "e2e-mi-" + category.toLowerCase() + "-" + (index + 1);
      return {
        id, category,
        title: "E2E " + category.replaceAll("_", " ").toLowerCase() + " " + (index + 1),
        summary: "Synthetic E2E finding with traceable test evidence.",
        observedClaim: "The E2E fixture contains a traceable public evidence item for this finding.",
        inference: "This is a controlled test observation, not production market intelligence.",
        recommendedAction: "Review the evidence and create the appropriate owner-approved response.",
        confidence: 0.86, evidenceStrength: "high", recurrenceCount: 3, sourceDiversity: 2, relevanceScore: 0.9, freshnessScore: 0.95, status: "active",
        firstObservedAt: new Date(Date.now() - 3_600_000).toISOString(),
        lastObservedAt: new Date(Date.now() - 600_000).toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        evidence: [{
          id: id + "-evidence",
          source: "E2E public evidence", sourceType: "web", sourceUrl: "https://example.com/leadmachine-market-intelligence/" + id, externalId: id,
          title: "E2E evidence source", author: null, publishedAt: new Date(Date.now() - 1_800_000).toISOString(), discoveredAt: new Date().toISOString(),
          evidenceText: "Controlled evidence fixture for browser acceptance testing.", sourceMetadata: { e2e: true },
        }],
      };
    });
  }
  return { enabled: true, updatedAt: new Date(Date.now() - 300_000).toISOString(), categories, stats: { totalActive: 21, evidenceCount: 21, lastRunAt: new Date(Date.now() - 300_000).toISOString() } };
}