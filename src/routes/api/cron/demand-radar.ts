import { createFileRoute } from "@tanstack/react-router";
import { processDemandRadar } from "@/lib/demand-radar.server";
import { processE2EDemandRadar } from "@/lib/e2e-demand-radar.server";

export const Route = createFileRoute("/api/cron/demand-radar")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (process.env["E2E_MODE"] === "true") {
    return Response.json(processE2EDemandRadar());
  }

  try {
    const result = await processDemandRadar(25);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[DemandRadar] cron failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Demand Radar failed" }, { status: 500 });
  }
}
