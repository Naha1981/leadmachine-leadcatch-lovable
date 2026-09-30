import { sendText } from "@/lib/operator.server";
import { getZeroUIConfig } from "./zero-ui-tenant.server";
import { normalizePhoneNumber } from "./zero-ui-phone.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
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
