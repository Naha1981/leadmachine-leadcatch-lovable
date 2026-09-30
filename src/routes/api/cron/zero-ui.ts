import { createFileRoute } from "@tanstack/react-router";
import { processZeroUIFollowups } from "@/lib/zero-ui-worker.server";

export const Route = createFileRoute("/api/cron/zero-ui")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  if (request.headers.get("authorization") !== "Bearer " + process.env["CRON_SECRET"]) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (process.env["E2E_MODE"] === "true") {
    return Response.json({ ok: true, processed: [] });
  }
  try {
    const processed = await processZeroUIFollowups(25);
    return Response.json({ ok: true, processed });
  } catch (error) {
    console.error("[ZeroUI] worker failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Zero UI worker failed" }, { status: 500 });
  }
}
