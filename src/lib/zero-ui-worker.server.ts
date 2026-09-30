import { sendText } from "@/lib/operator.server";
import { getZeroUIConfig } from "./zero-ui-tenant.server";
import { normalizePhoneNumber } from "./zero-ui-phone.server";
import { processApprovedSalesActions } from "./agent-workforce-execution.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function processAgentWorkforceActions(limit = 5) {
  return processApprovedSalesActions(limit);
}

export async function processZeroUIFollowups(limit = 25) {
  const database = await db();
  const now = new Date().toISOString();
  const { data: due, error } = await database
    .from("zero_ui_followups")
    .select("id,tenant_id,lead_id,scheduled_at,message,attempt_count")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results: Array<Record<string, unknown>> = [];

  for (const followup of due ?? []) {
    const claim = await database
      .from("zero_ui_followups")
      .update({ status: "processing", attempt_count: (followup.attempt_count ?? 0) + 1 })
      .eq("id", followup.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claim.data) continue;

    try {
      const config = await getZeroUIConfig(database, followup.tenant_id);
      if (!config.enabled || !config.automation_enabled || !config.auto_followups_enabled) {
        await database.from("zero_ui_followups").update({ status: "cancelled", error: "Automation disabled" }).eq("id", followup.id).eq("tenant_id", followup.tenant_id);
        results.push({ id: followup.id, status: "cancelled" });
        continue;
      }

      const { data: lead } = await database
        .from("leads")
        .select("id,name,phone,status,service")
        .eq("tenant_id", followup.tenant_id)
        .eq("id", followup.lead_id)
        .maybeSingle();
      if (!lead) throw new Error("Lead no longer exists");

      const { data: latest } = await database
        .from("conversation_messages")
        .select("direction,created_at")
        .eq("tenant_id", followup.tenant_id)
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.direction === "inbound") {
        await database.from("zero_ui_followups").update({ status: "cancelled", error: "Lead replied before scheduled follow-up" }).eq("id", followup.id).eq("tenant_id", followup.tenant_id);
        results.push({ id: followup.id, status: "cancelled", reason: "lead_replied" });
        continue;
      }

      const { data: profile } = await database.from("business_profiles").select("wa_account_id").eq("tenant_id", followup.tenant_id).maybeSingle();
      if (!profile?.wa_account_id) throw new Error("WhatsApp is not connected");

      const sent = await sendText(followup.tenant_id, profile.wa_account_id, normalizePhoneNumber(lead.phone), followup.message);

      let { data: conversation } = await database.from("conversations").select("id").eq("tenant_id", followup.tenant_id).eq("lead_id", lead.id).maybeSingle();
      if (!conversation) {
        const created = await database.from("conversations").insert({ tenant_id: followup.tenant_id, lead_id: lead.id }).select("id").single();
        if (created.error) throw created.error;
        conversation = created.data;
      }

      await database.from("conversation_messages").insert({
        tenant_id: followup.tenant_id,
        conversation_id: conversation.id,
        lead_id: lead.id,
        direction: "outbound",
        body: followup.message,
        sender: "auto",
        is_auto: true,
        delivery_status: "sent",
        external_id: sent.message?.key?.id ?? null,
      });
      await database.from("conversations").update({
        last_message_preview: followup.message,
        last_message_at: new Date().toISOString(),
      }).eq("id", conversation.id).eq("tenant_id", followup.tenant_id);

      await database.from("zero_ui_followups").update({
        status: "completed",
        sent_at: new Date().toISOString(),
        error: null,
      }).eq("id", followup.id).eq("tenant_id", followup.tenant_id);

      await database.from("zero_ui_usage_events").insert({
        tenant_id: followup.tenant_id,
        event_type: "automated_followup_sent",
        idempotency_key: "followup-sent:" + followup.id,
        metadata: { followupId: followup.id, leadId: lead.id },
      }).select("id").maybeSingle();

      await database.from("zero_ui_audit_logs").insert({
        tenant_id: followup.tenant_id,
        actor_type: "system",
        action: "automated_followup_sent",
        target_type: "lead",
        target_id: lead.id,
        result: "success",
        metadata: { followupId: followup.id },
      });
      results.push({ id: followup.id, status: "completed", leadId: lead.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Follow-up failed";
      await database.from("zero_ui_followups").update({ status: "failed", error: message }).eq("id", followup.id).eq("tenant_id", followup.tenant_id);
      await database.from("zero_ui_audit_logs").insert({
        tenant_id: followup.tenant_id,
        actor_type: "system",
        action: "automated_followup_failed",
        target_type: "lead",
        target_id: followup.lead_id,
        result: "failed",
        metadata: { followupId: followup.id, error: message },
      });
      results.push({ id: followup.id, status: "failed", error: message });
    }
  }

  return results;
}


export async function processZeroUIDailySummaries(limit = 50) {
  const database = await db();
  const { data: configs, error } = await database
    .from("zero_ui_configs")
    .select("tenant_id,enabled,automation_enabled,owner_alerts_enabled,daily_summary_enabled,timezone")
    .eq("enabled", true)
    .eq("automation_enabled", true)
    .eq("owner_alerts_enabled", true)
    .eq("daily_summary_enabled", true)
    .limit(limit);
  if (error) throw error;

  const results: Array<Record<string, unknown>> = [];
  for (const config of configs ?? []) {
    const timezone = config.timezone || "Africa/Johannesburg";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const hour = get("hour");
    const minute = get("minute");
    const localDate = get("year") + "-" + get("month") + "-" + get("day");
    if (hour !== "08" || !["00", "05", "10"].includes(minute)) continue;

    const { data: profile } = await database
      .from("business_profiles")
      .select("business_name,contact_phone,wa_account_id,whatsapp_status")
      .eq("tenant_id", config.tenant_id)
      .maybeSingle();
    if (!profile?.contact_phone || !profile?.wa_account_id || profile?.whatsapp_status !== "connected") {
      results.push({ tenantId: config.tenant_id, status: "skipped", reason: "owner WhatsApp not connected" });
      continue;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: leads }, { data: staleHot }] = await Promise.all([
      database
        .from("leads")
        .select("id,name,service,suburb,ai_score,ai_temperature,status,created_at")
        .eq("tenant_id", config.tenant_id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      database
        .from("leads")
        .select("id")
        .eq("tenant_id", config.tenant_id)
        .eq("status", "new")
        .eq("ai_temperature", "hot")
        .lte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .limit(500),
    ]);

    const list = leads ?? [];
    const hot = list.filter((lead: any) => lead.ai_temperature === "hot").length;
    const warm = list.filter((lead: any) => lead.ai_temperature === "warm").length;
    const cold = list.filter((lead: any) => lead.ai_temperature === "cold").length;
    const top = list
      .filter((lead: any) => lead.ai_temperature === "hot")
      .slice(0, 3)
      .map((lead: any) => "• " + (lead.name || "Unknown lead") + " · " + (lead.service || "Enquiry") + " · " + (lead.suburb || "Area not captured") + " · " + (lead.ai_score ?? "—") + "/10")
      .join("\n");

    const message = [
      "☀️ DAILY LEADMACHINE SUMMARY",
      "",
      (profile.business_name || "Your business") + " · last 24 hours",
      "• " + list.length + " new leads",
      "• " + hot + " hot",
      "• " + warm + " warm",
      "• " + cold + " cold",
      "• " + (staleHot?.length ?? 0) + " hot leads older than 15 minutes",
      top ? "\n🔥 Top opportunities\n" + top : "",
      "",
      "LeadMachine is monitoring the inbox and follow-ups for you.",
    ].filter(Boolean).join("\n");

    const key = "daily-summary:" + config.tenant_id + ":" + localDate;
    const action = await database
      .from("zero_ui_agent_actions")
      .insert({
        tenant_id: config.tenant_id,
        action: "send_whatsapp_message",
        action_class: "automatic",
        target_type: "owner_phone",
        target_id: profile.contact_phone,
        idempotency_key: key,
        input: { message, localDate },
        status: "processing",
      })
      .select("id")
      .maybeSingle();

    if (action.error?.code === "23505") {
      results.push({ tenantId: config.tenant_id, status: "duplicate" });
      continue;
    }
    if (action.error) throw action.error;

    try {
      const sent = await sendText(config.tenant_id, profile.wa_account_id, normalizePhoneNumber(profile.contact_phone), message);
      await database.from("zero_ui_agent_actions").update({
        status: "completed",
        result: { externalId: sent.message?.key?.id ?? null },
        completed_at: new Date().toISOString(),
      }).eq("id", action.data.id).eq("tenant_id", config.tenant_id);
      await database.from("zero_ui_audit_logs").insert({
        tenant_id: config.tenant_id,
        actor_type: "system",
        action: "daily_zero_ui_summary_sent",
        target_type: "owner_phone",
        target_id: profile.contact_phone,
        result: "success",
        metadata: { localDate, leadCount: list.length, hot, warm, cold, staleHot: staleHot?.length ?? 0 },
      });
      results.push({ tenantId: config.tenant_id, status: "sent", hot, warm, cold });
    } catch (error) {
      const messageError = error instanceof Error ? error.message : "Daily summary failed";
      await database.from("zero_ui_agent_actions").update({
        status: "failed",
        error: messageError,
        completed_at: new Date().toISOString(),
      }).eq("id", action.data.id).eq("tenant_id", config.tenant_id);
      results.push({ tenantId: config.tenant_id, status: "failed", error: messageError });
    }
  }
  return results;
}
