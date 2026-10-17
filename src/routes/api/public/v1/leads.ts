import { createFileRoute } from "@tanstack/react-router";
import { tenantForApiKey } from "@/lib/api-keys.server";

/** GET /api/public/v1/leads - the tenant's leads as JSON. Auth: x-api-key header. */
export const Route = createFileRoute("/api/public/v1/leads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const tenantId = await tenantForApiKey(request);
        if (!tenantId) return Response.json({ ok: false, error: "Invalid or revoked API key." }, { status: 401 });
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const { data, error } = await db
          .from("leads")
          .select("id, name, phone, status, source, service, suburb, ai_score, ai_temperature, ai_summary, photo_paths, created_at, updated_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) return Response.json({ ok: false, error: "Could not read leads." }, { status: 500 });
        return Response.json({ ok: true, leads: data ?? [] });
      },
    },
  },
});
