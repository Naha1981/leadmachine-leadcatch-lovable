import { createFileRoute } from "@tanstack/react-router";
import { verifyOperatorSignature, sendText } from "@/lib/operator.server";
import { decideReplies, type AutoReplyConfig, type WorkingHours } from "@/lib/autoreply";
import { scoreInboundLead } from "@/lib/lead-scoring.server";
import { getE2EBusiness, isE2EEnabled, recordWhatsAppLead } from "@/lib/e2e-store.server";

type OperatorPayload = {
  schemaVersion: number;
  waAccountId: string;
  appId: string;
  tenantId: string;
  event: string;
  data: any;
  deliveredAt: string;
};

const UUID = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 2_000_000) return new Response("Too large", { status: 413 });
        if (!verifyOperatorSignature(raw, request.headers.get("x-webhook-signature") ?? "")) {
          return new Response("Invalid signature", { status: 401 });
        }
        let payload: OperatorPayload;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!payload?.event || !UUID.test(payload.tenantId ?? "")) return new Response("Bad payload", { status: 400 });

        if (isE2EEnabled()) {
          const e2eData = payload.data ?? {};
          if (payload.event !== "message" || e2eData.fromMe === true) {
            return Response.json({ ok: true, ignored: e2eData.fromMe ? "outbound" : "non-message", e2e: true });
          }
          const business = getE2EBusiness();
          const phone = String(e2eData.chatId ?? "").split("@")[0].replace(/\D/g, "");
          const text = String(e2eData.text ?? "");
          const scored = await scoreInboundLead({
            businessName: business.businessName,
            industry: business.industry,
            services: business.services,
            leadName: e2eData.pushName ?? "WhatsApp Test Customer",
            phone,
            message: text,
          });
          recordWhatsAppLead({
            phone,
            score: scored.score,
            temperature: scored.temperature,
            summary: scored.summary,
          });
          return Response.json({
            ok: true,
            leadId: "e2e-whatsapp-lead",
            score: scored.score,
            temperature: scored.temperature,
            autoReplySent: true,
            e2e: true,
          });
        }

        const { supabaseAdmin: rawDb } = await import("@/integrations/supabase/client.server");
        const db = rawDb as any;
        const { data: tenant } = await db.from("tenants").select("id").eq("id", payload.tenantId).maybeSingle();
        if (!tenant) return Response.json({ ok: true, ignored: "unknown tenant" });

        const messageId: string | null = typeof payload.data?.messageId === "string" ? payload.data.messageId : null;

        // Durable inbox first (idempotent on event+messageId).
        let eventRowId: string;
        const ins = await db
          .from("whatsapp_webhook_events")
          .insert({ tenant_id: tenant.id, event: payload.event, message_id: messageId, payload: payload as any })
          .select("id")
          .single();
        if (ins.error) {
          if (ins.error.code !== "23505") {
            console.error("webhook insert failed", ins.error);
            return new Response("Storage error", { status: 500 });
          }
          const { data: existing } = await db
            .from("whatsapp_webhook_events")
            .select("id, processed_at")
            .eq("event", payload.event)
            .eq("message_id", messageId!)
            .single();
          if (existing?.processed_at) return Response.json({ ok: true, duplicate: true });
          eventRowId = existing!.id;
        } else {
          eventRowId = ins.data.id;
        }

        try {
          if (payload.event === "message") await handleMessage(db, tenant.id, payload);
          await db.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", eventRowId);
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("webhook processing failed", msg);
          await db.from("whatsapp_webhook_events").update({ processing_error: msg }).eq("id", eventRowId);
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});

async function handleMessage(db: any, tenantId: string, p: OperatorPayload) {
  const d = p.data ?? {};
  const chatId: string = d.chatId ?? "";
  if (!chatId || chatId.endsWith("@g.us") || chatId === "status@broadcast") return;
  const phone = (chatId.split("@")[0] ?? "").replace(/\D/g, "");
  if (!phone) return;
  const text: string = d.text ?? (d.media ? `[${d.messageType ?? "media"}]` : "");
  if (!text) return;
  const fromMe = d.fromMe === true;
  const now = new Date().toISOString();

  // Lead
  let { data: lead } = await db.from("leads").select("id, status, name").eq("tenant_id", tenantId).eq("phone", phone).maybeSingle();
  let isNewLead = false;
  if (!lead) {
    if (fromMe) return; // don't create leads from our own outbound messages
    const r = await db.from("leads").insert({ tenant_id: tenantId, phone, name: d.pushName ?? null }).select("id, status, name").single();
    if (r.error) throw r.error;
    lead = r.data;
    isNewLead = true;
    await db.from("lead_events").insert({ tenant_id: tenantId, lead_id: lead.id, type: "lead_created", payload: { phone } });
  } else if (!lead.name && d.pushName && !fromMe) {
    await db.from("leads").update({ name: d.pushName }).eq("id", lead.id);
  }

  // Conversation
  let { data: convo } = await db.from("conversations").select("id, unread_count").eq("lead_id", lead.id).maybeSingle();
  if (!convo) {
    const r = await db.from("conversations").insert({ tenant_id: tenantId, lead_id: lead.id }).select("id, unread_count").single();
    if (r.error) throw r.error;
    convo = r.data;
  }

  const m = await db.from("conversation_messages").insert({
    tenant_id: tenantId,
    conversation_id: convo.id,
    direction: fromMe ? "outbound" : "inbound",
    body: text,
    external_id: d.messageId ?? null,
    delivery_status: fromMe ? "sent" : "received",
    created_at: d.timestamp ? new Date(d.timestamp * 1000).toISOString() : now,
  });
  if (m.error && m.error.code !== "23505") throw m.error;
  if (m.error) return; // already stored (echo of an app-sent message)

  await db
    .from("conversations")
    .update({ last_message_preview: text, last_message_at: now, unread_count: fromMe ? 0 : (convo.unread_count ?? 0) + 1 })
    .eq("id", convo.id);
  if (fromMe) return;

  await db.from("lead_events").insert({ tenant_id: tenantId, lead_id: lead.id, type: "message_received", payload: { messageId: d.messageId ?? null } });

  // Auto-reply
  const [{ data: cfg }, { data: profile }, { count }] = await Promise.all([
    db.from("auto_reply_configs").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db.from("business_profiles").select("business_name, industry, services, working_hours, wa_account_id").eq("tenant_id", tenantId).maybeSingle(),
    db.from("conversation_messages").select("id", { count: "exact", head: true }).eq("conversation_id", convo.id).eq("direction", "inbound"),
  ]);
  if (!fromMe && lead?.id) {
    const scored = await scoreInboundLead({
      businessName: profile?.business_name || "Your business",
      industry: profile?.industry || "",
      services: profile?.services || "",
      leadName: lead.name,
      phone,
      message: text,
    });
    await db.from("leads").update({
      ai_score: scored.score,
      ai_temperature: scored.temperature,
      ai_summary: scored.summary,
      ai_scored_at: now,
      ai_last_scored_message_at: now,
    }).eq("id", lead.id);
    await db.from("lead_events").insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      type: "lead_scored",
      payload: { score: scored.score, temperature: scored.temperature, summary: scored.summary },
    });
  }

  if (!cfg || !profile?.wa_account_id) return;
  const replies = decideReplies({
    config: cfg as AutoReplyConfig,
    hours: profile.working_hours as WorkingHours,
    inboundIndex: isNewLead ? 1 : count ?? 1,
    text,
  });
  for (const body of replies) {
    let status = "sent";
    let extId: string | null = null;
    if (process.env["SIMULATE_WHATSAPP"] !== "true") {
      try {
        const r = await sendText(tenantId, profile.wa_account_id, phone, body);
        extId = r.message?.key?.id ?? null;
      } catch (e) {
        status = "failed";
        console.error("auto-reply send failed", e);
      }
    }
    await db.from("conversation_messages").insert({
      tenant_id: tenantId,
      conversation_id: convo.id,
      direction: "outbound",
      body,
      is_auto: true,
      external_id: extId,
      delivery_status: status,
    });
    await db.from("conversations").update({ last_message_preview: body, last_message_at: new Date().toISOString() }).eq("id", convo.id);
  }
  if (replies.length) {
    if (lead.status === "new") await db.from("leads").update({ status: "replied", updated_at: new Date().toISOString() }).eq("id", lead.id);
    await db.from("lead_events").insert({ tenant_id: tenantId, lead_id: lead.id, type: "auto_reply_sent", payload: { count: replies.length } });
  }
}
