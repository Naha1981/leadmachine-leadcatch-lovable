import { describe, expect, test } from "bun:test";
import { MARKET_INTELLIGENCE_CATEGORIES, MARKET_INTELLIGENCE_LIMITS } from "../src/lib/market-intelligence.constants";
import { clusterKey, deterministicCategory, freshnessScore, scoreEvidence, selectTopSignals } from "../src/lib/market-intelligence.server";
import { collectAgentReachEvidence, evidenceHash } from "../src/lib/market-intelligence.sources.server";

describe("market intelligence contracts", () => {
  test("uses only the five product categories", () => {
    expect(MARKET_INTELLIGENCE_CATEGORIES).toHaveLength(5);
    expect(new Set(MARKET_INTELLIGENCE_CATEGORIES).size).toBe(5);
  });

  test("one weak source cannot become high confidence", () => {
    const result = scoreEvidence({ recurrenceCount: 1, sourceDiversity: 1, relevance: 1, freshness: 1 });
    expect(result.evidenceStrength).toBe("insufficient");
    expect(result.confidence).toBeLessThan(0.5);
  });

  test("multiple independent sources can reach high evidence strength", () => {
    const result = scoreEvidence({ recurrenceCount: 6, sourceDiversity: 4, relevance: 0.95, freshness: 0.95 });
    expect(result.evidenceStrength).toBe("high");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test("stale signals are excluded from top-n selection", () => {
    const fresh = { category: "CUSTOMER_PROBLEMS", lastObservedAt: new Date().toISOString(), freshnessScore: 0.9, confidence: 0.8, relevanceScore: 0.8, id: "fresh" };
    const stale = { category: "CUSTOMER_PROBLEMS", lastObservedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(), freshnessScore: 0.1, confidence: 0.9, relevanceScore: 0.9, id: "stale" };
    const result = selectTopSignals([fresh, stale]);
    expect(result.CUSTOMER_PROBLEMS.map((item) => item.id)).toEqual(["fresh"]);
    expect(result.CUSTOMER_PROBLEMS.length).toBeLessThanOrEqual(MARKET_INTELLIGENCE_LIMITS.CUSTOMER_PROBLEMS);
  });

  test("source evidence is deterministic and category-scoped", () => {
    const doc = { sourceType: "reddit" as const, sourceUrl: "https://reddit.com/r/test/1", externalId: "abc", title: "Question", evidenceText: "Need a quote today" };
    expect(evidenceHash(doc, "CUSTOMER_PROBLEMS")).toBe(evidenceHash(doc, "CUSTOMER_PROBLEMS"));
    expect(evidenceHash(doc, "CUSTOMER_PROBLEMS")).not.toBe(evidenceHash(doc, "LEAD_GENERATION_OPPORTUNITIES"));
  });

  test("documents are classified into stable product categories", () => {
    const categories = deterministicCategory({ source: "Reddit", sourceType: "reddit", sourceUrl: "https://reddit.com/x", title: "How much does emergency plumbing cost?", evidenceText: "I need a quote today for a broken geyser." });
    expect(categories).toContain("CUSTOMER_PROBLEMS");
    expect(categories).toContain("UNANSWERED_QUESTIONS");
    expect(categories).toContain("CONTENT_OPPORTUNITIES");
    expect(categories).toContain("LEAD_GENERATION_OPPORTUNITIES");
  });

  test("cluster keys are stable", () => {
    expect(clusterKey("CUSTOMER_PROBLEMS", "Roof repair pricing is too confusing", "roof repair, waterproofing")).toBe(clusterKey("CUSTOMER_PROBLEMS", "Roof repair pricing is too confusing", "roof repair, waterproofing"));
  });


  test("top-n limits match the five product contracts", () => {
    const now = new Date().toISOString();
    const signals = MARKET_INTELLIGENCE_CATEGORIES.flatMap((category) =>
      Array.from({ length: 10 }, (_, index) => ({
        category,
        lastObservedAt: now,
        freshnessScore: 0.9,
        confidence: 0.8,
        relevanceScore: 0.8,
        id: category + "-" + index,
      })),
    );
    const result = selectTopSignals(signals);
    for (const category of MARKET_INTELLIGENCE_CATEGORIES) {
      expect(result[category].length).toBe(MARKET_INTELLIGENCE_LIMITS[category]);
    }
  });

  test("Agent Reach source failure is isolated", async () => {
    const originalEnabled = process.env.AGENT_REACH_ENABLED;
    const originalUrl = process.env.AGENT_REACH_API_URL;
    process.env.AGENT_REACH_ENABLED = "false";
    delete process.env.AGENT_REACH_API_URL;
    await expect(collectAgentReachEvidence({ tenantId: "00000000-0000-0000-0000-000000000001", queries: ["test"], competitorUrls: [] })).resolves.toEqual([]);
    if (originalEnabled === undefined) delete process.env.AGENT_REACH_ENABLED;
    else process.env.AGENT_REACH_ENABLED = originalEnabled;
    if (originalUrl === undefined) delete process.env.AGENT_REACH_API_URL;
    else process.env.AGENT_REACH_API_URL = originalUrl;
  });

  test("freshness reaches zero at expiry", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    const past = new Date("2026-09-18T00:00:00Z");
    expect(freshnessScore(past, now, 14)).toBe(0);
  });
});
