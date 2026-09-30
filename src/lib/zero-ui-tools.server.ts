import { sendText } from "@/lib/operator.server";
import { assertActionAllowed, getActionClass } from "./zero-ui-policy.server";
import { normalizePhoneNumber } from "./zero-ui-phone.server";
import { getZeroUIConfig } from "./zero-ui-tenant.server";

export type ZeroUIToolContext = {
  tenantId: string;
  actorType: "owner_whatsapp" | "staff" | "agent" | "system" | "user";
  actorId: string;
  agentRunId?: string | null;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getBusinessSettings(ctx: ZeroUIToolContext) {
  const database = await db();
  const [{ data: profile }, config] = await Promise.all([
    database.from("business_profiles").select("*").eq("tenant_id", ctx.tenantId).single(),
    getZeroUIConfig(database, ctx.tenantId),
  ]);
  return { profile, config };
}

export async function searchLeads(ctx: ZeroUIToolContext, opts: { temperature?: string; status?: string; limit?: number } = {}) {
  const database = await db();
  let query = database
    .from("leads")
    .select("id,name,phone,service,suburb,urgency,status,ai_score,ai_temperature,ai_summary,created_at,last_message_at,first_response_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 20, 50));
  if (opts.temperature) query = query.eq("ai_temperature", opts.temperature);
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getLead(ctx: ZeroUIToolContext, leadId: string) {
  const database = await db();
  const { data, error } = await database
    .from("leads")
    .select("id,name,phone,service,suburb,urgency,status,ai_score,ai_temperature,ai_summary,created_at,last_message_at,first_response_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Lead not found");
  return data;
}

export async function searchConversation(ctx: ZeroUIToolContext, leadId: string) {
  const database = await db();
  await getLead(ctx, leadId);
  const { data, error } = await database
    .from("conversation_messages")
    .select("id,direction,body,is_auto,delivery_status,created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function getLeadMetrics(ctx: ZeroUIToolContext) {
  const database = await db();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: leads }, { data: stale }] = await Promise.all([
    database.from("leads").select("id,name,service,suburb,ai_score,ai_temperature,status,created_at,first_response_at,last_message_at").eq("tenant_id", ctx.tenantId).gte("created_at", since).limit(500),
    database.from("leads").select("id").eq("tenant_id", ctx.tenantId).eq("status", "new").eq("ai_temperature", "hot").lte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString()).limit(500),
  ]);
  if (!leads) return { total: 0, hot: 0, warm: 0, cold: 0, staleHot: stale?.length ?? 0, avgResponseMinutes: null as number | null };
  let responseTotal = 0;
  let responseCount = 0;
  for (const lead of leads) {
    if (lead.first_response_at && lead.created_at) {
      const mins = (new Date(lead.first_response_at).getTime() - new Date(lead.created_at).getTime()) / 60000;
      if (Number.isFinite(mins) && mins >= 0) {
        responseTotal += mins;
        responseCount += 1;
      }
    }
  }
  return {
    total: leads.length,
    hot: leads.filter((l: any) => l.ai_temperature === "hot").length,
    warm: leads.filter((l: any) => l.ai_temperature === "warm").length,
    cold: leads.filter((l: any) => l.ai_temperature === "cold").length,
    staleHot: stale?.length ?? 0,
    avgResponseMinutes: responseCount ? Math.round(responseTotal / responseCount) : null,
  };
}

export async function sendWhatsAppMessage(ctx: ZeroUIToolContext, leadId: string, body: string) {
  assertActionAllowed("send_whatsapp_message");
  const database = await db();
  const lead = await getLead(ctx, leadId);
  const { data: profile } = await database.from("business_profiles").select("wa_account_id").eq("tenant_id", ctx.tenantId).single();
  if (!profile?.wa_account_id) throw new Error("WhatsApp is not connected");

  let { data: conversation } = await database.from("conversations").select("id").eq("tenant_id", ctx.tenantId).eq("lead_id", leadId).maybeSingle();
  if (!conversation) {
    const created = await database.from("conversations").insert({ tenant_id: ctx.tenantId, lead_id: leadId }).select("id").single();
    if (created.error) throw created.error;
    conversation = created.data;
  }

  const inserted = await database.from("conversation_messages").insert({
    tenant_id: ctx.tenantId,
    conversation_id: conversation.id,
    lead_id: leadId,
    direction: "outbound",
    body,
    sender: ctx.actorType === "agent" ? "auto" : "agent",
    is_auto: ctx.actorType === "agent",
    delivery_status: "queued",
  }).select("id").single();
  if (inserted.error) throw inserted.error;

  try {
    const result = await sendText(ctx.tenantId, profile.wa_account_id, normalizePhoneNumber(lead.phone), body);
    await database.from("conversation_messages").update({
      delivery_status: "sent",
      external_id: result.message?.key?.id ?? null,
    }).eq("id", inserted.data.id).eq("tenant_id", ctx.tenantId);
    await database.from("conversations").update({
      last_message_preview: body,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    }).eq("id", conversation.id).eq("tenant_id", ctx.tenantId);
    if (lead.status === "new") {
      await database.from("leads").update({ status: "replied", updated_at: new Date().toISOString() }).eq("id", leadId).eq("tenant_id", ctx.tenantId);
    }
    return { ok: true, externalId: result.message?.key?.id ?? null };
  } catch (error) {
    await database.from("conversation_messages").update({ delivery_status: "failed" }).eq("id", inserted.data.id).eq("tenant_id", ctx.tenantId);
    throw error;
  }
}

export async function notifyOwner(ctx: ZeroUIToolContext, message: string, idempotencyKey: string) {
  assertActionAllowed("notify_owner");
  const database = await db();
  const { data: profile } = await database.from("business_profiles").select("contact_phone,wa_account_id").eq("tenant_id", ctx.tenantId).single();
  const config = await getZeroUIConfig(database, ctx.tenantId);
  if (!config.enabled || !config.owner_alerts_enabled) return { ok: false, ignored: true, reason: "Owner alerts disabled" };
  const phone = normalizePhoneNumber(profile?.contact_phone);
  if (!phone || !profile?.wa_account_id) return { ok: false, ignored: true, reason: "Owner alert WhatsApp is not configured" };

  const inserted = await database.from("zero_ui_agent_actions").insert({
    tenant_id: ctx.tenantId,
    agent_run_id: ctx.agentRunId ?? null,
    action: "notify_owner",
    action_class: getActionClass("notify_owner"),
    target_type: "owner_phone",
    target_id: phone,
    idempotency_key: idempotencyKey,
    input: { message },
    status: "processing",
  }).select("id").maybeSingle();

  if (inserted.error?.code === "23505") return { ok: true, duplicate: true };
  if (inserted.error) throw inserted.error;

  try {
    const sent = await sendText(ctx.tenantId, profile.wa_account_id, phone, message);
    await database.from("zero_ui_agent_actions").update({
      status: "completed",
      result: { externalId: sent.message?.key?.id ?? null },
      completed_at: new Date().toISOString(),
    }).eq("id", inserted.data.id).eq("tenant_id", ctx.tenantId);
    await database.from("zero_ui_usage_events").insert({
      tenant_id: ctx.tenantId,
      event_type: "owner_notification",
      idempotency_key: "owner-notification:" + idempotencyKey,
      metadata: { actionId: inserted.data.id },
    }).select("id").maybeSingle();
    return { ok: true, externalId: sent.message?.key?.id ?? null };
  } catch (error) {
    await database.from("zero_ui_agent_actions").update({
      status: "failed",
      error: error instanceof Error ? error.message : "Owner notification failed",
      completed_at: new Date().toISOString(),
    }).eq("id", inserted.data.id).eq("tenant_id", ctx.tenantId);
    throw error;
  }
}

export async function scheduleFollowup(ctx: ZeroUIToolContext, leadId: string, scheduledAt: string, message: string, reason = "owner_request") {
  assertActionAllowed("schedule_followup");
  const database = await db();
  const lead = await getLead(ctx, leadId);
  const key = "followup:" + ctx.tenantId + ":" + lead.id + ":" + scheduledAt;
  const inserted = await database.from("zero_ui_agent_actions").insert({
    tenant_id: ctx.tenantId,
    agent_run_id: ctx.agentRunId ?? null,
    action: "schedule_followup",
    action_class: getActionClass("schedule_followup"),
    target_type: "lead",
    target_id: lead.id,
    idempotency_key: key,
    input: { scheduledAt, message, reason },
    status: "completed",
    result: { scheduledAt },
    completed_at: new Date().toISOString(),
  }).select("id").maybeSingle();

  if (inserted.error?.code === "23505") return { ok: true, duplicate: true };
  if (inserted.error) throw inserted.error;

  const followup = await database.from("zero_ui_followups").insert({
    tenant_id: ctx.tenantId,
    lead_id: lead.id,
    scheduled_at: scheduledAt,
    message,
    reason,
    agent_action_id: inserted.data.id,
  }).select("id").single();
  if (followup.error) throw followup.error;
  return { ok: true, followupId: followup.data.id };
}

export async function audit(ctx: ZeroUIToolContext, action: string, result: "success" | "failed" | "rejected" | "ignored", metadata: Record<string, unknown> = {}, target?: { type?: string; id?: string }) {
  const database = await db();
  await database.from("zero_ui_audit_logs").insert({
    tenant_id: ctx.tenantId,
    actor_type: ctx.actorType,
    actor_id: ctx.actorId,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    result,
    metadata,
  });
}

export async function recordUsage(ctx: ZeroUIToolContext, eventType: string, metadata: Record<string, unknown> = {}, idempotencyKey?: string) {
  const database = await db();
  await database.from("zero_ui_usage_events").insert({
    tenant_id: ctx.tenantId,
    event_type: eventType,
    idempotency_key: idempotencyKey ?? null,
    metadata,
  }).select("id").maybeSingle();
}
