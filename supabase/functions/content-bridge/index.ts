// content-bridge: server-side proxy between the app and the content/publishing service.
// Keeps the service key server-side (stored in public.service_config), derives the
// caller's workspace from their own session, and only allows that workspace.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_BASE = "https://nahalabs-content-api.nahalabs.workers.dev";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...cors } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "sign in required" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u, error: ue } = await svc.auth.getUser(jwt);
    if (ue || !u.user) return json({ error: "sign in required" }, 401);

    // Resolve the caller's workspace the same way the app does.
    let tenantId: string | null = null;
    const { data: roles } = await svc.from("user_roles").select("tenant_id, role").eq("user_id", u.user.id);
    const memberOf = (roles ?? []).find((r: { role: string }) => r.role !== "owner");
    if (memberOf) tenantId = memberOf.tenant_id;
    if (!tenantId) {
      const { data: t } = await svc.from("tenants").select("id").eq("owner_id", u.user.id).maybeSingle();
      tenantId = t?.id ?? null;
    }
    if (!tenantId) return json({ error: "no workspace" }, 403);

    const { data: cfg } = await svc.from("service_config").select("value").eq("key", "content_api_key").maybeSingle();
    if (!cfg?.value) return json({ error: "posting service not configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const call = async (method: string, path: string, payload?: unknown) => {
      const r = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${cfg.value}`,
          "x-workspace-id": tenantId!,
          "content-type": "application/json",
          "user-agent": "RevenueDesk/1.0",
          ...(payload && (body as { idempotency_key?: string }).idempotency_key
            ? { "idempotency-key": (body as { idempotency_key: string }).idempotency_key }
            : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, body: j };
    };

    switch (body.action) {
      case "accounts": {
        const r = await call("GET", "/api/v1/accounts");
        return json(r.body, r.status);
      }
      case "connect": {
        if (body.channel !== "bluesky") return json({ error: "unsupported channel" }, 422);
        if (!body.handle || !body.app_password) return json({ error: "handle and app_password required" }, 422);
        const r = await call("PUT", `/api/v1/channels/${body.channel}`, { handle: body.handle, app_password: body.app_password });
        return json(r.body, r.status);
      }
      case "create": {
        if (body.channel !== "bluesky" || !body.caption) return json({ error: "channel and caption required" }, 422);
        const r = await call("POST", "/api/v1/posts", {
          channel: body.channel, caption: body.caption, title: body.title ?? "", internal_notes: body.internal_notes ?? "",
        });
        return json(r.body, r.status);
      }
      case "schedule": {
        if (!body.id) return json({ error: "id required" }, 422);
        const r = await call("POST", `/api/v1/posts/${body.id}/schedule`, body.scheduled_at ? { scheduled_at: body.scheduled_at } : {});
        return json(r.body, r.status);
      }
      case "cancel": {
        if (!body.id) return json({ error: "id required" }, 422);
        const r = await call("POST", `/api/v1/posts/${body.id}/cancel`);
        return json(r.body, r.status);
      }
      case "radar": {
        const q = new URLSearchParams();
        if (body.industry) q.set("industry", String(body.industry).slice(0, 60));
        if (body.area) q.set("area", String(body.area).slice(0, 60));
        const qs = q.toString();
        const r = await call("GET", `/v1/radar/weekly${qs ? `?${qs}` : ""}`);
        return json(r.body, r.status);
      }
      case "list": {
        const r = await call("GET", `/api/v1/posts${body.status ? `?status=${encodeURIComponent(body.status)}` : ""}`);
        return json(r.body, r.status);
      }
      default:
        return json({ error: "unknown action" }, 422);
    }
  } catch (e) {
    return json({ error: String((e as Error).message || e).slice(0, 200) }, 500);
  }
});
