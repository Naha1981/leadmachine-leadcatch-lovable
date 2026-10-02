import { createFileRoute } from "@tanstack/react-router";
import { processMarketIntelligence } from "@/lib/market-intelligence.server";

export const Route = createFileRoute("/api/cron/market-intelligence")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const expected = process.env["MARKET_INTELLIGENCE_CRON_SECRET"] || process.env["CRON_SECRET"];
  if (!expected || request.headers.get("authorization") !== "Bearer " + expected) return new Response("Unauthorized", { status: 401 });
  const mode = new URL(request.url).searchParams.get("mode") === "daily" ? "daily" : "regular";
  try {
    const result = await processMarketIntelligence(25, mode);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[MarketIntelligence] cron failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Market Intelligence failed" }, { status: 500 });
  }
}
