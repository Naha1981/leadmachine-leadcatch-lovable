import { createFileRoute } from "@tanstack/react-router";
import { getProductionReadiness } from "@/lib/production-readiness.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const readiness = await getProductionReadiness();
          return Response.json(
            {
              ok: readiness.ready,
              service: "leadmachine",
              ...readiness,
            },
            {
              status: readiness.ready ? 200 : 503,
              headers: {
                "Cache-Control": "no-store, max-age=0, must-revalidate",
              },
            },
          );
        } catch (error) {
          console.error("[production-readiness] health check failed", error);
          return Response.json(
            {
              ok: false,
              service: "leadmachine",
              error: "Production readiness check failed.",
            },
            {
              status: 503,
              headers: {
                "Cache-Control": "no-store, max-age=0, must-revalidate",
              },
            },
          );
        }
      },
    },
  },
});
