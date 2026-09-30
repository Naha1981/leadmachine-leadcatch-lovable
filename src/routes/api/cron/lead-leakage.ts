import { createFileRoute } from "@tanstack/react-router";
import { processHotLeadLeakageAlerts } from "@/lib/leakage.server";
import { alertLeakage, isE2EEnabled } from "@/lib/e2e-store.server";

function authorized(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  const supplied = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");
  return supplied === secret;
}

export const Route = createFileRoute("/api/cron/lead-leakage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          if (isE2EEnabled()) return Response.json({ ok: true, processed: [alertLeakage()], count: 1, e2e: true });
          const processed = await processHotLeadLeakageAlerts(50);
          return Response.json({ ok: true, processed, count: processed.length });
        } catch (e) {
          console.error("lead leakage cron failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "Leakage worker failed" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          if (isE2EEnabled()) return Response.json({ ok: true, processed: [alertLeakage()], count: 1, e2e: true });
          const processed = await processHotLeadLeakageAlerts(50);
          return Response.json({ ok: true, processed, count: processed.length });
        } catch (e) {
          console.error("lead leakage cron failed", e);
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "Leakage worker failed" }, { status: 500 });
        }
      },
    },
  },
});
