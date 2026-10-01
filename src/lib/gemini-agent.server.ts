import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreInboundLead } from "@/lib/lead-scoring.server";
import { requireTenantRole } from "@/lib/zero-ui-tenant.server";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_TURNS = 6;

type AgentDeps = {
  db: SupabaseClient;
  adminDb: SupabaseClient;
  tenantId: string;
  userId: string;
};

type ToolCallResult = {
  output: unknown;
  auditAction?: string;
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "search_leads",
    description:
      "Search the current tenant's LeadMachine leads. Use this for pipeline questions, finding customers, finding hot leads, or locating leads by phone/name/service.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional name, phone, service or suburb search text." },
        status: {
          type: "string",
          enum: ["new", "replied", "qualified", "quoted", "won", "lost"],
          description: "Optional pipeline status filter.",
        },
        temperature: {
          type: "string",
          enum: ["hot", "warm", "cold"],
          description: "Optional AI temperature filter.",
        },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Maximum results to return." },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_lead",
    description: "Get one lead plus its most recent WhatsApp conversation messages.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead UUID." },
      },
      required: ["lead_id"],
    },
  },
  {
    type: "function",
    name: "get_pipeline_summary",
    description: "Get a compact summary of the current tenant's lead pipeline by status and AI temperature.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: "score_lead",
    description: "Re-score a saved lead from its recent conversation using LeadMachine's existing scoring system.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead UUID." },
      },
      required: ["lead_id"],
    },
  },
  {
    type: "function",
    name: "update_lead",
    description:
      "Update editable LeadMachine lead fields for the current tenant. Only use fields the user explicitly asked you to change or fields directly implied by a clear operational request.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead UUID." },
        name: { type: "string" },
        status: {
          type: "string",
          enum: ["new", "replied", "qualified", "quoted", "won", "lost"],
        },
        service: { type: "string" },
        suburb: { type: "string" },
        urgency: {
          type: "string",
          enum: ["low", "normal", "high", "emergency"],
        },
        notes: { type: "string" },
        estimated_value_cents: { type: "integer", minimum: 0 },
        actual_revenue_cents: { type: "integer", minimum: 0 },
      },
      required: ["lead_id"],
    },
  },
  {
    type: "function",
    name: "schedule_followup",
    description:
      "Schedule a follow-up for a lead in LeadMachine. This creates a durable follow-up record; it does not send the message immediately.",
    parameters: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "Lead UUID." },
        scheduled_at: { type: "string", description: "ISO-8601 timestamp with timezone." },
        message: { type: "string", description: "WhatsApp follow-up message." },
        reason: { type: "string", description: "Why the follow-up is being scheduled." },
      },
      required: ["lead_id", "scheduled_at", "message"],
    },
  },
] as const;

const SYSTEM_INSTRUCTION = [
  "You are the LeadMachine operating agent for a South African service business.",
  "Your job is to operate the tenant's LeadMachine data, not to give generic CRM advice.",
  "Use tools whenever the user's request can be answered or executed against LeadMachine data.",
  "Never invent lead data, scores, statuses, prices, messages, or actions.",
  "Current time zone is Africa/Johannesburg.",
  "A request to inspect or analyse data is read-only.",
  "A request to change a lead, schedule a follow-up, or re-score a lead is an explicit operational instruction and may be executed through the provided tools.",
  "Never claim an external WhatsApp message was sent because this agent does not have a direct-send tool yet.",
  "For any action result, report exactly what changed and identify the lead when possible.",
  "Prefer concise, decision-oriented answers with concrete IDs, statuses and next actions.",
].join(" ");

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return value.toLowerCase() === "true";
}

async function geminiRequest(body: Record<string, unknown>) {
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  if (!apiKey) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to the server environment.");

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  const text = await response.text();
  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const detail = typeof payload?.error?.message === "string" ? payload.error.message : text.slice(0, 500);
    throw new Error(`Gemini request failed (${response.status}): ${detail || "unknown error"}`);
  }

  return payload;
}

async function tenantProfile(deps: AgentDeps) {
  const { data, error } = await deps.db
    .from("business_profiles")
    .select("business_name,industry,trade,services,suburb,pricing_notes")
    .eq("tenant_id", deps.tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function searchLeads(deps: AgentDeps, args: any): Promise<ToolCallResult> {
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  let query = deps.db
    .from("leads")
    .select(
      "id,name,phone,status,service,suburb,urgency,estimated_value_cents,actual_revenue_cents,ai_score,ai_temperature,ai_summary,last_message_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (args.status) query = query.eq("status", args.status);
  if (args.temperature) query = query.eq("ai_temperature", args.temperature);
  if (typeof args.query === "string" && args.query.trim()) {
    const q = args.query.trim().replace(/[(),]/g, " ");
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,service.ilike.%${q}%,suburb.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    output: { count: data?.length ?? 0, leads: data ?? [] },
    auditAction: "gemini.search_leads",
  };
}

async function getLead(deps: AgentDeps, args: any): Promise<ToolCallResult> {
  const leadId = String(args.lead_id || "");
  if (!leadId) throw new Error("lead_id is required.");

  const { data: lead, error } = await deps.db
    .from("leads")
    .select(
      "id,name,phone,status,service,suburb,urgency,estimated_value_cents,actual_revenue_cents,notes,ai_score,ai_temperature,ai_summary,ai_scored_at,last_message_at,first_response_at,created_at,updated_at",
    )
    .eq("id", leadId)
    .single();
  if (error || !lead) throw new Error("Lead not found.");

  const { data: messages, error: messageError } = await deps.db
    .from("conversation_messages")
    .select("id,direction,body,sender,delivery_status,created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (messageError) throw messageError;

  return {
    output: { lead, messages: (messages ?? []).reverse() },
    auditAction: "gemini.get_lead",
  };
}

async function getPipelineSummary(deps: AgentDeps): Promise<ToolCallResult> {
  const statuses = ["new", "replied", "qualified", "quoted", "won", "lost"] as const;
  const temperatures = ["hot", "warm", "cold"] as const;

  const statusCounts = Object.fromEntries(
    await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await deps.db
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        if (error) throw error;
        return [status, count ?? 0];
      }),
    ),
  );

  const temperatureCounts = Object.fromEntries(
    await Promise.all(
      temperatures.map(async (temperature) => {
        const { count, error } = await deps.db
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("ai_temperature", temperature);
        if (error) throw error;
        return [temperature, count ?? 0];
      }),
    ),
  );

  return {
    output: { statusCounts, temperatureCounts },
    auditAction: "gemini.get_pipeline_summary",
  };
}

async function scoreLead(deps: AgentDeps, args: any): Promise<ToolCallResult> {
  const leadId = String(args.lead_id || "");
  if (!leadId) throw new Error("lead_id is required.");
  await requireTenantRole(deps.db, deps.userId, deps.tenantId, ["owner", "admin", "agent"]);

  const { data: lead, error } = await deps.db
    .from("leads")
    .select("id,tenant_id,name,phone,service,conversation_messages(direction,body,created_at)")
    .eq("id", leadId)
    .single();
  if (error || !lead) throw new Error("Lead not found.");

  const messages = (((lead as any).conversation_messages ?? []) as Array<any>)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-25)
    .map((m) => `${m.direction === "inbound" ? "Customer" : "Business"}: ${m.body}`)
    .join("\n");

  if (!messages) throw new Error("This lead has no conversation messages to score.");

  const { data: profile, error: profileError } = await deps.db
    .from("business_profiles")
    .select("business_name,industry,trade,services")
    .eq("tenant_id", deps.tenantId)
    .maybeSingle();
  if (profileError) throw profileError;

  const scored = await scoreInboundLead({
    businessName: profile?.business_name || "Your business",
    industry: profile?.industry || profile?.trade || "",
    services: profile?.services || "",
    leadName: lead.name,
    phone: lead.phone,
    message: messages,
  });

  const { error: updateError } = await deps.db
    .from("leads")
    .update({
      ai_score: scored.score,
      ai_temperature: scored.temperature,
      ai_summary: scored.summary,
      ai_scored_at: new Date().toISOString(),
      ai_last_scored_message_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (updateError) throw updateError;

  return {
    output: { leadId, score: scored.score, temperature: scored.temperature, summary: scored.summary, followUp: scored.followUp },
    auditAction: "gemini.score_lead",
  };
}

async function updateLead(deps: AgentDeps, args: any): Promise<ToolCallResult> {
  const leadId = String(args.lead_id || "");
  if (!leadId) throw new Error("lead_id is required.");
  await requireTenantRole(deps.db, deps.userId, deps.tenantId, ["owner", "admin", "agent"]);

  const allowed = [
    "name",
    "status",
    "service",
    "suburb",
    "urgency",
    "notes",
    "estimated_value_cents",
    "actual_revenue_cents",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (args[key] !== undefined && args[key] !== null) patch[key] = args[key];
  }
  if (Object.keys(patch).length === 0) throw new Error("No lead fields were provided to update.");

  const { data: before, error: beforeError } = await deps.db
    .from("leads")
    .select("id,name,status,service,suburb,urgency,notes,estimated_value_cents,actual_revenue_cents")
    .eq("id", leadId)
    .single();
  if (beforeError || !before) throw new Error("Lead not found.");

  const { data: updated, error } = await deps.db
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .select("id,name,status,service,suburb,urgency,notes,estimated_value_cents,actual_revenue_cents")
    .single();
  if (error || !updated) throw error || new Error("Lead update failed.");

  return {
    output: { leadId, before, updated },
    auditAction: "gemini.update_lead",
  };
}

async function scheduleFollowup(deps: AgentDeps, args: any): Promise<ToolCallResult> {
  const leadId = String(args.lead_id || "");
  const message = String(args.message || "").trim();
  const scheduledAt = String(args.scheduled_at || "").trim();
  if (!leadId || !message || !scheduledAt) throw new Error("lead_id, scheduled_at and message are required.");
  await requireTenantRole(deps.db, deps.userId, deps.tenantId, ["owner", "admin", "agent"]);

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("scheduled_at must be a valid ISO-8601 timestamp.");
  if (when.getTime() <= Date.now()) throw new Error("scheduled_at must be in the future.");

  const { data: lead, error: leadError } = await deps.db
    .from("leads")
    .select("id,name")
    .eq("id", leadId)
    .single();
  if (leadError || !lead) throw new Error("Lead not found.");

  const { data, error } = await deps.adminDb
    .from("zero_ui_followups")
    .insert({
      tenant_id: deps.tenantId,
      lead_id: leadId,
      scheduled_at: when.toISOString(),
      message: message.slice(0, 1500),
      reason: String(args.reason || "gemini_operator").slice(0, 120),
      status: "pending",
    })
    .select("id,lead_id,scheduled_at,message,reason,status")
    .single();

  if (error || !data) throw error || new Error("Could not schedule follow-up.");

  return {
    output: { followup: data, note: "Scheduled only; no WhatsApp message was sent by this action." },
    auditAction: "gemini.schedule_followup",
  };
}

async function executeTool(deps: AgentDeps, name: string, args: any): Promise<ToolCallResult> {
  switch (name) {
    case "search_leads":
      return searchLeads(deps, args);
    case "get_lead":
      return getLead(deps, args);
    case "get_pipeline_summary":
      return getPipelineSummary(deps);
    case "score_lead":
      return scoreLead(deps, args);
    case "update_lead":
      return updateLead(deps, args);
    case "schedule_followup":
      return scheduleFollowup(deps, args);
    default:
      throw new Error(`Unknown Gemini tool: ${name}`);
  }
}

async function auditTool(deps: AgentDeps, action: string, result: "success" | "failed", metadata: Record<string, unknown>) {
  await deps.adminDb.from("zero_ui_audit_logs").insert({
    tenant_id: deps.tenantId,
    actor_type: "user",
    actor_id: deps.userId,
    action,
    result,
    metadata,
  });
}

export async function runLeadMachineGeminiAgent(
  deps: AgentDeps,
  input: string,
  previousInteractionId?: string | null,
) {
  if (!envBool("GEMINI_AGENT_ENABLED", true)) throw new Error("Gemini Operator is currently disabled.");
  const model = process.env["GEMINI_AGENT_MODEL"]?.trim() || DEFAULT_MODEL;
  const store = envBool("GEMINI_AGENT_STORE", true);

  if (previousInteractionId) {
    const { data: previousRun, error: previousRunError } = await deps.adminDb
      .from("zero_ui_agent_runs")
      .select("tenant_id,input_summary,correlation_id")
      .eq("tenant_id", deps.tenantId)
      .eq("correlation_id", previousInteractionId)
      .maybeSingle();
    if (previousRunError) throw previousRunError;
    const ownerId = (previousRun?.input_summary as any)?.userId;
    if (!previousRun || ownerId !== deps.userId) {
      throw new Error("Invalid Gemini conversation context.");
    }
  }

  const profile = await tenantProfile(deps);

  const prompt = `Business context: ${profile?.business_name || "Unknown business"}; industry: ${profile?.industry || profile?.trade || "service business"}; services: ${profile?.services || "not specified"}; suburb: ${profile?.suburb || "South Africa"}.

User request:
${input}`;

  let interaction = await geminiRequest({
    model,
    input: prompt,
    previous_interaction_id: previousInteractionId || undefined,
    system_instruction: SYSTEM_INSTRUCTION,
    tools: TOOL_DEFINITIONS,
    store,
  });

  const runInsert = await deps.adminDb
    .from("zero_ui_agent_runs")
    .insert({
      tenant_id: deps.tenantId,
      trigger: "gemini_operator",
      intent: input.slice(0, 500),
      status: "running",
      provider: "google-gemini",
      model,
      correlation_id: interaction?.id || null,
      input_summary: { prompt: input.slice(0, 1200), userId: deps.userId },
    })
    .select("id")
    .single();

  const agentRunId = runInsert.data?.id ?? null;
  const toolEvents: Array<{ name: string; status: "completed" | "failed"; output?: unknown }> = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const calls = (Array.isArray(interaction?.steps) ? interaction.steps : []).filter(
        (step: any) => step?.type === "function_call",
      );

      if (calls.length === 0) {
        const outputText =
          typeof interaction?.output_text === "string"
            ? interaction.output_text
            : extractModelOutput(interaction?.steps);

        if (!outputText) throw new Error("Gemini returned no final response.");

        if (agentRunId) {
          await deps.adminDb
            .from("zero_ui_agent_runs")
            .update({
              status: "completed",
              output_summary: { toolEvents: toolEvents.map((e) => ({ name: e.name, status: e.status })) },
              completed_at: new Date().toISOString(),
            })
            .eq("id", agentRunId);
        }

        return {
          interactionId: interaction.id as string | null,
          outputText,
          toolEvents,
        };
      }

      const functionResults = [];

      for (const call of calls) {
        try {
          const result = await executeTool(deps, call.name, call.arguments ?? {});
          functionResults.push({
            type: "function_result",
            call_id: call.id,
            name: call.name,
            result: [{ type: "text", text: JSON.stringify(result.output) }],
          });
          toolEvents.push({ name: call.name, status: "completed", output: result.output });
          if (result.auditAction) {
            await auditTool(deps, result.auditAction, "success", { args: call.arguments ?? {}, output: result.output });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool execution failed";
          functionResults.push({
            type: "function_result",
            call_id: call.id,
            name: call.name,
            result: [{ type: "text", text: JSON.stringify({ error: message }) }],
          });
          toolEvents.push({ name: call.name, status: "failed", output: { error: message } });
          await auditTool(deps, `gemini.${call.name}`, "failed", { args: call.arguments ?? {}, error: message });
        }
      }

      interaction = await geminiRequest({
        model,
        previous_interaction_id: interaction.id,
        input: functionResults,
        system_instruction: SYSTEM_INSTRUCTION,
        tools: TOOL_DEFINITIONS,
        store,
      });
    }

    throw new Error("Gemini reached the maximum tool-execution turns for this request.");
  } catch (error) {
    if (agentRunId) {
      await deps.adminDb
        .from("zero_ui_agent_runs")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Gemini agent failed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", agentRunId);
    }
    throw error;
  }
}

function extractModelOutput(steps: any[]): string {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step?.type !== "model_output" || !Array.isArray(step.content)) continue;
    const text = step.content
      .filter((part: any) => part?.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}
