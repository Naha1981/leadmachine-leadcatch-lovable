/** Outbound tenant webhooks: fire-and-record delivery. */

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST an event to every active tenant webhook subscribed to it, recording each delivery. */
export async function fireTenantEvent(tenantId: string, event: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: hooks, error } = await db
      .from("tenant_webhooks")
      .select("id, url, secret, events")
      .eq("tenant_id", tenantId)
      .eq("active", true);
    if (error || !hooks?.length) return;
    const body = JSON.stringify({ event, data: payload, sent_at: new Date().toISOString() });
    await Promise.all(
      hooks
        .filter((h: any) => Array.isArray(h.events) && h.events.includes(event))
        .map(async (h: any) => {
          const signature = await hmacSha256Hex(h.secret, body);
          let status: number | null = null;
          let ok = false;
          let errText: string | null = null;
          try {
            const res = await fetch(h.url, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-revenuedesk-signature": signature, "x-revenuedesk-event": event },
              body,
              signal: AbortSignal.timeout(10_000),
            });
            status = res.status;
            ok = res.ok;
            if (!res.ok) errText = (await res.text().catch(() => "")).slice(0, 300);
          } catch (e) {
            errText = e instanceof Error ? e.message.slice(0, 300) : "network error";
          }
          await db.from("webhook_deliveries").insert({
            tenant_id: tenantId,
            webhook_id: h.id,
            event,
            payload,
            status,
            ok,
            error: errText,
          });
        }),
    );
  } catch (e) {
    console.error("fireTenantEvent failed", e);
  }
}
