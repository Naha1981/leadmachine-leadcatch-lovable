import { randomUUID } from "node:crypto";
import { sendText } from "@/lib/operator.server";
import { requireTenantRole } from "./zero-ui-tenant.server";
import { normalizePhoneNumber } from "./zero-ui-phone.server";
import { runOpenBotAgUi } from "./agent-workforce/openbot-agui.server";

export type SalesExecutionInput = {
  runId: string;
  businessName: string;
  contactName?: string | undefined;
  prospectPhone?: string | undefined;
  websiteUrl: string;
  location?: string | undefined;
  category?: string | undefined;
  evidence: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
};

type ReceiptStatus = "started" | "completed" | "failed" | "skipped" | "outcome_unknown";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function tenantForUser(userId: string) {
  const database = await db();
  const { data, error } = await database.from("tenants").select("id").eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Workspace not found");
  return data.id as string;
}

async function audit(tenantId: string, actorId: string | null, action: string, result: "success" | "failed" | "rejected" | "ignored", metadata: Record<string, unknown> = {}) {
  const database = await db();
  await database.from("zero_ui_audit_logs").insert({
    tenant_id: tenantId,
    actor_type: actorId ? "user" : "system",
    actor_id: actorId,
    action,
    result,
    metadata,
  });
}

export async function requestSalesExecutionApproval(userId: string, input: SalesExecutionInput) {
  const database = await db();
  const tenantId = await tenantForUser(userId);
  await requireTenantRole(database, userId, tenantId, ["owner", "admin"]);
  const idempotencyKey = "sales-recovery:" + tenantId + ":" + input.runId + ":" + Buffer.from([input.businessName, input.websiteUrl, input.prospectPhone ?? ""].join("|")).toString("base64url").slice(0, 100);

  const existing = await database.from("zero_ui_agent_actions").select("id,status").eq("tenant_id", tenantId).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing.data) {
    const existingApproval = await database.from("zero_ui_approvals").select("id,status").eq("agent_action_id", existing.data.id).maybeSingle();
    return { actionId: existing.data.id as string, approvalId: existingApproval.data?.id as string | undefined, status: existing.data.status as string, approvalStatus: existingApproval.data?.status as string | undefined, duplicate: true };
  }

  const actionInsert = await database.from("zero_ui_agent_actions").insert({
    tenant_id: tenantId,
    agent_run_id: input.runId,
    action: "sales.revenue_recovery",
    action_class: "approval_required",
    target_type: "prospect",
    target_id: input.prospectPhone || input.websiteUrl,
    idempotency_key: idempotencyKey,
    input,
    status: "pending",
  }).select("id").single();
  if (actionInsert.error) throw actionInsert.error;

  const approvalInsert = await database.from("zero_ui_approvals").insert({
    tenant_id: tenantId,
    agent_action_id: actionInsert.data.id,
    status: "pending",
  }).select("id").single();
  if (approvalInsert.error) throw approvalInsert.error;

  await audit(tenantId, userId, "sales_execution_approval_requested", "success", { actionId: actionInsert.data.id, approvalId: approvalInsert.data.id, businessName: input.businessName, prospectPhone: input.prospectPhone ?? null });
  return { actionId: actionInsert.data.id as string, approvalId: approvalInsert.data.id as string, status: "pending", approvalStatus: "pending", duplicate: false };
}

export async function resolveSalesExecutionApproval(userId: string, actionId: string, decision: "approved" | "rejected", note?: string) {
  const database = await db();
  const tenantId = await tenantForUser(userId);
  await requireTenantRole(database, userId, tenantId, ["owner", "admin"]);
  const { data: action, error: actionError } = await database.from("zero_ui_agent_actions").select("id,tenant_id,status").eq("id", actionId).eq("tenant_id", tenantId).eq("action", "sales.revenue_recovery").maybeSingle();
  if (actionError) throw actionError;
  if (!action) throw new Error("Sales action not found");
  const { data: approval, error: approvalError } = await database.from("zero_ui_approvals").select("id,status").eq("tenant_id", tenantId).eq("agent_action_id", actionId).maybeSingle();
  if (approvalError) throw approvalError;
  if (!approval) throw new Error("Approval record not found");
  if (approval.status !== "pending") return { actionId, approvalId: approval.id, approvalStatus: approval.status, actionStatus: action.status };

  await database.from("zero_ui_approvals").update({ status: decision, resolved_at: new Date().toISOString(), resolved_by: userId, note: note?.slice(0, 1000) ?? null }).eq("id", approval.id).eq("tenant_id", tenantId).eq("status", "pending");
  await database.from("zero_ui_agent_actions").update({ status: decision === "approved" ? "pending" : "rejected", error: decision === "approved" ? null : "Execution rejected by workspace user" }).eq("id", actionId).eq("tenant_id", tenantId);
  await audit(tenantId, userId, "sales_execution_approval_" + decision, decision === "approved" ? "success" : "rejected", { actionId, approvalId: approval.id, note: note ?? null });

  return { actionId, approvalId: approval.id, approvalStatus: decision, actionStatus: decision === "approved" ? "pending" : "rejected" };
}

export async function getSalesExecutionStatus(userId: string, actionId: string) {
  const database = await db();
  const tenantId = await tenantForUser(userId);
  await requireTenantRole(database, userId, tenantId, ["owner", "admin", "agent", "viewer"]);
  const { data: action, error: actionError } = await database.from("zero_ui_agent_actions").select("id,status,input,result,error,created_at,completed_at").eq("tenant_id", tenantId).eq("id", actionId).eq("action", "sales.revenue_recovery").maybeSingle();
  if (actionError) throw actionError;
  if (!action) throw new Error("Sales action not found");
  const { data: approval } = await database.from("zero_ui_approvals").select("id,status,requested_at,resolved_at,resolved_by,note").eq("tenant_id", tenantId).eq("agent_action_id", actionId).maybeSingle();
  const { data: receipts } = await database.from("zero_ui_action_receipts").select("id,step,provider,status,external_id,output_summary,created_at").eq("tenant_id", tenantId).eq("agent_action_id", actionId).order("created_at", { ascending: true });
  return { action: { id: action.id, status: action.status, result: action.result ?? {}, error: action.error, createdAt: action.created_at, completedAt: action.completed_at }, approval: approval ?? null, receipts: receipts ?? [] };
}

async function receipt(tenantId: string, agentActionId: string, step: string, provider: string, status: ReceiptStatus, outputSummary: Record<string, unknown> = {}, externalId?: string | null) {
  const database = await db();
  await database.from("zero_ui_action_receipts").insert({ tenant_id: tenantId, agent_action_id: agentActionId, step, provider, status, external_id: externalId ?? null, output_summary: outputSummary });
}

async function renderProspectVideo(actionId: string, input: SalesExecutionInput) {
  const base = process.env["VIDEO_ENGINE_URL"]?.trim();
  const key = process.env["VIDEO_ENGINE_API_KEY"]?.trim();
  if (!base || !key) return { status: "skipped" as const, reason: "Video engine not configured" };
  const endpoint = new URL("/render", base).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Video-Engine-Key": key },
    body: JSON.stringify({
      prospectId: actionId,
      businessName: input.businessName,
      industry: input.category || "Service business",
      location: input.location || "Johannesburg",
      website: input.websiteUrl,
      currentCta: "LeadMachine research scan",
      currentEnquiryFlow: "Public website research",
      digitalPresenceGap: String(input.findings[0]?.["detail"] ?? "Evidence-led conversion opportunity identified."),
      observedEnquiryFriction: String(input.findings[0]?.["detail"] ?? "Public enquiry journey requires a closer look."),
      potentialLeakageRisk: String(input.findings[1]?.["detail"] ?? "Research signal; commercial impact still requires validation."),
      leadMachineConcept: "LeadMachine turns enquiries into evidence, priority, next action and approved follow-up.",
      conversionEvent: "Qualified opportunity / booked job",
      followUpSequence: "Evidence → diagnosis → approved action → follow-up",
      prospectTier: "Research",
      demoUrl: "https://demo.leadmachine.co.za/" + encodeURIComponent(actionId),
    }),
    redirect: "error",
    signal: AbortSignal.timeout(180000),
  });
  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok) {
    if (response.status >= 500 || response.status === 408) throw new Error("Video engine outcome is unknown after HTTP " + response.status + ".");
    throw new Error("Video engine rejected the render (HTTP " + response.status + ").");
  }
  return { status: "completed" as const, videoUrl: typeof payload.videoUrl === "string" ? payload.videoUrl : null, jobId: typeof payload.jobId === "string" ? payload.jobId : null };
}

async function executeSalesActionRow(action: any) {
  const database = await db();
  const actionId = action.id as string;
  const tenantId = action.tenant_id as string;
  const input = action.input as SalesExecutionInput;
  const approval = await database.from("zero_ui_approvals").select("id,status").eq("tenant_id", tenantId).eq("agent_action_id", actionId).maybeSingle();
  if (approval.data?.status !== "approved") return { actionId, status: "skipped", reason: "Approval not granted" };

  const runtimeUrl = process.env["OPENBOT_AGUI_URL"]?.trim();
  const runtimeToken = process.env["OPENBOT_AGENT_TOKEN"]?.trim();
  const results: Record<string, unknown> = {};
  let successfulSteps = 0;

  if (runtimeUrl && runtimeToken) {
    const threadId = "leadmachine:" + tenantId + ":" + actionId;
    const runId = randomUUID();
    await receipt(tenantId, actionId, "openbot.prepare", "openbot-ag-ui", "started", { threadId, runId });
    try {
      const result = await runOpenBotAgUi({
        threadId,
        runId,
        messages: [{ id: randomUUID(), role: "user", content: "Prepare the approved LeadMachine sales execution for prospect " + input.businessName + ". Review the supplied public evidence and return a concise execution checklist. Do not contact the prospect, publish anything, change accounts, or take external action." }],
        context: [{ type: "tenant", tenantId }, { type: "prospect", businessName: input.businessName, websiteUrl: input.websiteUrl, location: input.location ?? null }],
        forwardedProps: { openbotRun: { tenantId, actionId, runId, approved: true } },
      });
      results["openbot"] = result;
      await receipt(tenantId, actionId, "openbot.prepare", "openbot-ag-ui", result.status === "completed" ? "completed" : "failed", { outputText: result.outputText.slice(0, 4000), eventCount: result.eventCount }, result.runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenBot preparation failed";
      const outcomeUnknown = /outcome is unknown/i.test(message);
      results["openbot"] = { status: outcomeUnknown ? "outcome_unknown" : "failed", error: message };
      await receipt(tenantId, actionId, "openbot.prepare", "openbot-ag-ui", outcomeUnknown ? "outcome_unknown" : "failed", { error: message });
    }
  } else {
    await receipt(tenantId, actionId, "openbot.prepare", "openbot-ag-ui", "skipped", { reason: "OpenBot AG-UI is not configured" });
  }

  let videoUrl: string | null = null;
  try {
    await receipt(tenantId, actionId, "video.render", "remotion", "started");
    const rendered = await renderProspectVideo(actionId, input);
    if (rendered.status === "skipped") {
      await receipt(tenantId, actionId, "video.render", "remotion", "skipped", { reason: rendered.reason });
    } else {
      successfulSteps += 1;
      videoUrl = rendered.videoUrl;
      results["video"] = rendered;
      await receipt(tenantId, actionId, "video.render", "remotion", "completed", { videoUrl: rendered.videoUrl, jobId: rendered.jobId }, rendered.jobId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video render failed";
    const outcomeUnknown = /outcome is unknown/i.test(message);
    results["video"] = { status: outcomeUnknown ? "outcome_unknown" : "failed", error: message };
    await receipt(tenantId, actionId, "video.render", "remotion", outcomeUnknown ? "outcome_unknown" : "failed", { error: message });
  }

  const prospectPhone = normalizePhoneNumber(input.prospectPhone ?? "");
  if (!prospectPhone) {
    await receipt(tenantId, actionId, "whatsapp.send", "nahalabs-operator", "skipped", { reason: "No prospect phone supplied" });
  } else {
    try {
      await receipt(tenantId, actionId, "whatsapp.send", "nahalabs-operator", "started", { prospectPhone });
      const { data: profile } = await database.from("business_profiles").select("wa_account_id,whatsapp_status").eq("tenant_id", tenantId).maybeSingle();
      if (!profile?.wa_account_id || profile.whatsapp_status !== "connected") throw new Error("Business WhatsApp is not connected.");
      const evidenceTitles = input.findings.slice(0, 2).map((item) => String(item["title"] ?? "observed opportunity")).join("; ");
      const contact = input.contactName ? " " + input.contactName : "";
      const message = "Hi" + contact + ", I’m Thabiso from NahaLabs. We looked at " + input.businessName + "’s public enquiry journey and found a specific opportunity: " + evidenceTitles + ". I put together a short LeadMachine walkthrough using the same evidence. " + (videoUrl ? videoUrl + " " : "") + "No assumptions about lost revenue — just the observed signal and the proposed fix. Worth a 10-minute look?";
      const sent = await sendText(tenantId, profile.wa_account_id, prospectPhone, message);
      const externalId = sent.message?.key?.id ?? null;
      successfulSteps += 1;
      results["whatsapp"] = { status: "completed", externalId };
      await receipt(tenantId, actionId, "whatsapp.send", "nahalabs-operator", "completed", { prospectPhone, message: message.slice(0, 1200) }, externalId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp send failed";
      const outcomeUnknown = /outcome is unknown|network|timeout|timed out/i.test(message);
      results["whatsapp"] = { status: outcomeUnknown ? "outcome_unknown" : "failed", error: message };
      await receipt(tenantId, actionId, "whatsapp.send", "nahalabs-operator", outcomeUnknown ? "outcome_unknown" : "failed", { error: message });
    }
  }

  const finalStatus = successfulSteps > 0 ? "completed" : "failed";
  await database.from("zero_ui_agent_actions").update({ status: finalStatus, result: results, error: finalStatus === "failed" ? "No execution step completed successfully." : null, completed_at: new Date().toISOString() }).eq("id", actionId).eq("tenant_id", tenantId);
  await audit(tenantId, null, finalStatus === "completed" ? "sales_execution_completed" : "sales_execution_failed", finalStatus === "completed" ? "success" : "failed", { actionId, businessName: input.businessName, results });
  return { actionId, status: finalStatus, results };
}

export async function processApprovedSalesActions(limit = 5) {
  const database = await db();
  const { data: pending, error } = await database.from("zero_ui_agent_actions").select("id,tenant_id,input,status,created_at").eq("action", "sales.revenue_recovery").eq("status", "pending").order("created_at", { ascending: true }).limit(limit);
  if (error) throw error;
  const results: Array<Record<string, unknown>> = [];
  for (const action of pending ?? []) {
    const claim = await database.from("zero_ui_agent_actions").update({ status: "processing" }).eq("id", action.id).eq("status", "pending").select("id").maybeSingle();
    if (!claim.data) continue;
    try {
      const result = await executeSalesActionRow(action);
      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sales execution failed";
      await database.from("zero_ui_agent_actions").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", action.id).eq("tenant_id", action.tenant_id);
      await audit(action.tenant_id, null, "sales_execution_failed", "failed", { actionId: action.id, error: message });
      results.push({ actionId: action.id, status: "failed", error: message });
    }
  }
  return results;
}