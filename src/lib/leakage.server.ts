import { sendText, operatorRequest } from "@/lib/operator.server";

const WAIT_MS = 15 * 60 * 1000;

export async function sendSmsAlert(opts: { to: string; text: string; tenantId: string }) {
  if (process.env.SIMULATE_SMS === "true") return { ok: true, simulated: true };
  const url = process.env.SMS_ALERT_WEBHOOK_URL;
  if (!url) return { ok: false, simulated: false, reason: "SMS gateway not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_ALERT_WEBHOOK_SECRET ? { "X-Lead-Machine-Secret": process.env.SMS_ALERT_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ event: "lead.leakage_alert", tenantId: opts.tenantId, to: opts.to, message: opts.text }),
    });
    return { ok: res.ok, simulated: false, reason: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, simulated: false, reason: e instanceof Error ? e.message : "SMS failed" };
  }
}

export async function processHotLeadLeakageAlerts(limit = 25) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - WAIT_MS).toISOString();
  const { data: leads, error } = await db
    .from("leads")
    .select("id, tenant_id, name, phone, service, ai_score, ai_temperature, status, created_at")
    .eq("status", "new")
    .eq("ai_temperature", "hot")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const results: Array<{ leadId: string; status: string; whatsapp?: boolean; sms?: boolean; reason?: string }> = [];

  for (const lead of leads ?? []) {
    const { data: existing } = await db.from("lead_leakage_alerts").select("id").eq("lead_id", lead.id).maybeSingle();
    if (existing) continue;

    const claim = await db
      .from("lead_leakage_alerts")
      .insert({ tenant_id: lead.tenant_id, lead_id: lead.id, status: "processing" })
      .select("id")
      .single();

    if (claim.error) {
      if (claim.error.code === "23505") continue;
      throw claim.error;
    }

    try {
      const [{ data: profile }] = await Promise.all([
        db.from("business_profiles").select("business_name, contact_phone, whatsapp_number, wa_account_id, whatsapp_status").eq("tenant_id", lead.tenant_id).maybeSingle(),
      ]);
      const ownerPhone = profile?.contact_phone || profile?.whatsapp_number || null;
      if (!ownerPhone) throw new Error("No owner phone configured");
      const text =
        `🚨 HOT LEAD STILL WAITING — ${profile?.business_name || "Your business"}\n\n` +
        `Name: ${lead.name || "Unknown"}\nPhone: ${lead.phone}\nService: ${lead.service || "Not specified"}\nAI Score: ${lead.ai_score ?? "—"}/10\nWaiting: ${Math.max(15, Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 60000))} minutes\n\nContact this lead now.`;

      let whatsapp = false;
      let sms = false;
      if (process.env.SIMULATE_WHATSAPP === "true") {
        whatsapp = true;
      } else if (profile?.whatsapp_status === "connected" && profile.wa_account_id) {
        const sent = await sendText(lead.tenant_id, profile.wa_account_id, ownerPhone, text);
        whatsapp = sent.ok !== false;
      }
      const smsResult = await sendSmsAlert({ to: ownerPhone, text, tenantId: lead.tenant_id });
      sms = smsResult.ok;

      if (!whatsapp && !sms) throw new Error("No alert channel delivered");
      await db.from("lead_leakage_alerts").update({
        status: "sent",
        whatsapp_sent: whatsapp,
        sms_sent: sms,
        alerted_at: new Date().toISOString(),
        payload: { waiting_minutes: Math.max(15, Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 60000)) },
      }).eq("id", claim.data.id);
      await db.from("lead_events").insert({ tenant_id: lead.tenant_id, lead_id: lead.id, type: "hot_lead_leakage_alerted", payload: { whatsapp, sms } });
      results.push({ leadId: lead.id, status: "alerted", whatsapp, sms });
    } catch (e) {
      await db.from("lead_leakage_alerts").update({ status: "failed", error: e instanceof Error ? e.message : "Alert failed" }).eq("id", claim.data.id);
      results.push({ leadId: lead.id, status: "failed", reason: e instanceof Error ? e.message : "Alert failed" });
    }
  }
  return results;
}
