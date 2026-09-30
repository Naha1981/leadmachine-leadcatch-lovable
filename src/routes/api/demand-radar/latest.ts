import { createFileRoute } from "@tanstack/react-router";
import { getE2EDemandSignal } from "@/lib/e2e-demand-radar.server";

export const Route = createFileRoute("/api/demand-radar/latest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env["E2E_MODE"] === "true") return Response.json({ ok: true, signal: getE2EDemandSignal() });

        const { supabaseAdmin: rawDb } = await import("@/integrations/supabase/client.server");
        const db = rawDb as any;
        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: user } = await db.auth.getUser(token);
        if (!user?.user) return new Response("Unauthorized", { status: 401 });

        const { data: profile } = await db.from("profiles").select("tenant_id").eq("id", user.user.id).maybeSingle();
        if (!profile?.tenant_id) return new Response("Unauthorized", { status: 401 });

        const { data: signal, error } = await db
          .from("demand_radar_signals")
          .select("id,title,body,service,suburb,urgency,intent_score,source_name,source_url,status,alerted_at,detected_at")
          .eq("tenant_id", profile.tenant_id)
          .order("detected_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, signal });
      },
    },
  },
});
