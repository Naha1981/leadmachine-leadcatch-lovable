import { zeroUiChat } from "./zero-ui.llm.server";
import { assertActionAllowed } from "./zero-ui-policy.server";
import {
  audit,
  getBusinessSettings,
  getLeadMetrics,
  searchConversation,
  searchLeads,
  scheduleFollowup,
  type ZeroUIToolContext,
} from "./zero-ui-tools.server";
import { getZeroUIConfig } from "./zero-ui-tenant.server";

type OwnerIntent =
  | "new_leads_summary"
  | "hot_leads"
  | "follow_up_unreplied"
  | "why_losing_leads"
  | "pause_automation"
  | "resume_automation"
  | "status"
  | "help"
  | "unknown";

function extractJson(raw: string): any {
  const ticks = String.fromCharCode(96);
  const cleaned = raw
    .replace(new RegExp(ticks + "{3}json", "gi"), "")
    .replace(new RegExp(ticks + "{3}", "g"), "")
    .trim();
  const start = cleaned.search(/[\[{]/);
  if (start < 0) throw new Error("No JSON in model response");
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(start, end + 1));
}

function fallbackIntent(text: string): OwnerIntent {
  const t = text.toLowerCase();
  if (/(new leads?|new enquiries?|new inquiries?)/.test(t)) return "new_leads_summary";
  if (/hot leads?|hottest leads?|high intent/.test(t)) return "hot_leads";
  if (/follow up|follow-up|chase|re-?contact.*(lead|customer)|hasn.?t replied|haven.?t replied/.test(t)) return "follow_up_unreplied";
  if (/why.*(losing|lose)|losing.*leads|leads?.*(lost|leaking)/.test(t)) return "why_losing_leads";
  if (/pause.*(automation|zero)|stop.*(automation|zero)/.test(t)) return "pause_automation";
  if (/resume.*(automation|zero)|start.*(automation|zero)/.test(t)) return "resume_automation";
  if (/status|how.*(doing|running)|zero ui/.test(t)) return "status";
  if (/help|what can you do|commands?/.test(t)) return "help";
  return "unknown";
}

async function classifyOwnerIntent(text: string) {
  const fallback = fallbackIntent(text);
  try {
    const result = await zeroUiChat([
      {
        role: "system",
        content:
          "You are the LeadMachine owner assistant. Classify an owner WhatsApp request into exactly one intent. " +
          'Return JSON only: {"intent":"new_leads_summary|hot_leads|follow_up_unreplied|why_losing_leads|pause_automation|resume_automation|status|help|unknown"}. ' +
          "Never invent a tenant, lead or action.",
      },
      { role: "user", content: text.slice(0, 2000) },
    ]);
    const parsed = extractJson(result.text);
    const allowed: OwnerIntent[] = [
      "new_leads_summary",
      "hot_leads",
      "follow_up_unreplied",
      "why_losing_leads",
      "pause_automation",
      "resume_automation",
      "status",
      "help",
      "unknown",
    ];
    const intent = allowed.includes(parsed.intent) ? parsed.intent as OwnerIntent : fallback;
    return { intent, provider: result.provider, model: result.model };
  } catch {
    return { intent: fallback, provider: "deterministic-fallback", model: "rules" };
  }
}

async function database() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function startRun(ctx: ZeroUIToolContext, trigger: string, input: Record<string, unknown>) {
  const db = await database();
  const { data, error } = await db.from("zero_ui_agent_runs").insert({
    tenant_id: ctx.tenantId,
    trigger,
    status: "running",
    input_summary: input,
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function finishRun(runId: string, patch: Record<string, unknown>) {
  const db = await database();
  await db.from("zero_ui_agent_runs").update({
    ...patch,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

function nextMorningNineAm() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
  const candidate = new Date(date + "T09:00:00+02:00");
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  const weekday = candidate.getDay();
  if (weekday === 6) candidate.setDate(candidate.getDate() + 2);
  if (weekday === 0) candidate.setDate(candidate.getDate() + 1);
  return candidate.toISOString();
}

function formatLeadLine(lead: any) {
  const name = lead.name || lead.phone;
  const service = lead.service || "Service enquiry";
  const area = lead.suburb || "Area not captured";
  const score = lead.ai_score != null ? String(lead.ai_score) + "/10" : "unscored";
  const temp = lead.ai_temperature ? " " + String(lead.ai_temperature).toUpperCase() : "";
  return "• " + name + " · " + service + " · " + area + " · " + score + temp;
}

async function handleFollowups(ctx: ZeroUIToolContext) {
  const settings = await getBusinessSettings(ctx);
  if (!settings.config.auto_followups_enabled) {
    return "Automatic follow-ups are paused for this business. I found the eligible leads but did not schedule anything.";
  }

  const candidates = await searchLeads(ctx, { limit: 50 });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const eligible: any[] = [];

  for (const lead of candidates) {
    if (!["replied", "qualified"].includes(lead.status)) continue;
    if (new Date(lead.last_message_at).getTime() > cutoff) continue;
    const messages = await searchConversation(ctx, lead.id);
    const latest = messages[messages.length - 1];
    if (!latest || latest.direction !== "outbound") continue;
    eligible.push(lead);
    if (eligible.length >= 20) break;
  }

  if (!eligible.length) return "I couldn't find any leads who are currently due for a follow-up.";

  const scheduledAt = nextMorningNineAm();
  let scheduled = 0;
  for (const lead of eligible) {
    try {
      await scheduleFollowup(
        ctx,
        lead.id,
        scheduledAt,
        "Hi " + (lead.name || "there") + ", just checking whether you'd still like us to help with your " + (lead.service || "enquiry") + ". Let me know and we'll arrange the next step.",
        "owner_request",
      );
      scheduled += 1;
    } catch {
      // Continue with the remaining eligible leads.
    }
  }

  const displayTime = new Date(scheduledAt).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
  return "✅ I found " + eligible.length + " eligible leads and scheduled " + scheduled + " follow-ups for " + displayTime + ".";
}

async function executeIntent(ctx: ZeroUIToolContext, intent: OwnerIntent) {
  switch (intent) {
    case "new_leads_summary": {
      const leads = await searchLeads(ctx, { limit: 50 });
      const metrics = await getLeadMetrics(ctx);
      if (!leads.length) return "No new leads in the last 24 hours.";
      const top = leads.slice(0, 5).map(formatLeadLine).join("\n");
      return "You have " + metrics.total + " leads in the last 24 hours: " + metrics.hot + " hot, " + metrics.warm + " warm, " + metrics.cold + " cold.\n\n" + top;
    }
    case "hot_leads": {
      const leads = await searchLeads(ctx, { temperature: "hot", limit: 10 });
      if (!leads.length) return "No HOT leads are currently in the inbox.";
      return "🔥 HOT LEADS\n\n" + leads.map(formatLeadLine).join("\n");
    }
    case "follow_up_unreplied":
      return handleFollowups(ctx);
    case "why_losing_leads": {
      const metrics = await getLeadMetrics(ctx);
      const reasons = [
        metrics.staleHot ? "• " + metrics.staleHot + " HOT leads are older than 15 minutes without a resolved response." : "",
        metrics.avgResponseMinutes != null ? "• Average first response over the last 24 hours is " + metrics.avgResponseMinutes + " minutes." : "",
        metrics.cold ? "• " + metrics.cold + " recent leads were scored COLD, indicating weak fit or low buying intent." : "",
        !metrics.staleHot && metrics.avgResponseMinutes != null && metrics.avgResponseMinutes <= 5
          ? "• Response speed is currently not the main visible leakage signal."
          : "",
      ].filter(Boolean);
      return "Based on the last 24 hours:\n\n" + (reasons.join("\n") || "There is not enough recent evidence to identify a clear leakage pattern yet.");
    }
    case "pause_automation": {
      assertActionAllowed("change_settings", { approved: true });
      const db = await database();
      await db.from("zero_ui_configs").update({ automation_enabled: false, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId);
      return "⏸️ Automation is paused. I will continue storing inbound activity, but I won't run automatic customer actions until you resume it.";
    }
    case "resume_automation": {
      assertActionAllowed("change_settings", { approved: true });
      const db = await database();
      await db.from("zero_ui_configs").update({ automation_enabled: true, updated_at: new Date().toISOString() }).eq("tenant_id", ctx.tenantId);
      return "▶️ Automation is active again.";
    }
    case "status": {
      const settings = await getBusinessSettings(ctx);
      const metrics = await getLeadMetrics(ctx);
      const wa = settings.profile?.whatsapp_status === "connected" ? "connected" : "not connected";
      return [
        "LeadMachine status for " + (settings.profile?.business_name || "your business") + ":",
        "• Zero UI: " + (settings.config.enabled ? "enabled" : "paused"),
        "• Automation: " + (settings.config.automation_enabled ? "active" : "paused"),
        "• WhatsApp: " + wa,
        "• Leads last 24h: " + metrics.total + " (" + metrics.hot + " hot)",
      ].join("\n");
    }
    case "help":
      return "I can handle: “Any new leads?”, “Show me today's hot leads”, “Follow up with everyone who hasn't replied”, “Why are we losing leads?”, “Pause automation”, “Resume automation”, and “Status”.";
    default:
      return "I didn't recognise that request. Try: “Any new leads?”, “Show me today's hot leads”, or “Follow up with everyone who hasn't replied.”";
  }
}

export async function handleOwnerCommand(baseCtx: Omit<ZeroUIToolContext, "agentRunId">, text: string) {
  const ctx: ZeroUIToolContext = { ...baseCtx, agentRunId: null };
  const db = await database();
  const config = await getZeroUIConfig(db, ctx.tenantId);
  if (!config.enabled) {
    await audit(ctx, "owner_command_ignored_zero_ui_disabled", "ignored", { text: text.slice(0, 500) });
    return "Zero UI is currently paused for this business. Open LeadMachine Control Centre and enable Zero UI first.";
  }

  const runId = await startRun(ctx, "owner_whatsapp_message", { text: text.slice(0, 500) });
  ctx.agentRunId = runId;
  try {
    const classified = await classifyOwnerIntent(text);
    await db.from("zero_ui_agent_runs").update({
      intent: classified.intent,
      provider: classified.provider,
      model: classified.model,
    }).eq("id", runId).eq("tenant_id", ctx.tenantId);

    const reply = await executeIntent(ctx, classified.intent);
    await finishRun(runId, {
      status: "completed",
      output_summary: { intent: classified.intent, reply: reply.slice(0, 1200) },
    });
    await audit(ctx, "owner_command:" + classified.intent, "success", { text: text.slice(0, 500), reply: reply.slice(0, 1200) });
    return reply;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zero UI action failed";
    await finishRun(runId, { status: "failed", error: message });
    await audit(ctx, "owner_command_failed", "failed", { text: text.slice(0, 500), error: message });
    return "I couldn't complete that request. No partial action was assumed. Please try again.";
  }
}
