import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

/** Streams a Responses call through the Lovable AI Gateway and returns the final text. */
async function chat(messages: Array<{ role: string; content: string }>, _maxTokens = 900): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured yet.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: messages,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits have run out. Top up to keep using AI features.");
  if (res.status === 403) throw new Error("AI access is currently blocked for this workspace.");
  if (!res.ok || !res.body) {
    console.error("AI gateway error", res.status, await res.text().catch(() => ""));
    throw new Error("The AI service could not be reached.");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        else if (ev.type === "response.failed" || ev.type === "error") throw new Error("The AI could not finish this request.");
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("The AI")) throw e;
      }
    }
  }
  if (!out.trim()) throw new Error("The AI returned no answer. Please try again later.");
  return out;
}

const INTENT_SYSTEM =
  "You qualify inbound WhatsApp leads for a South African service business. Assess purchase intent. " +
  'Reply with JSON only: {"score": 1-10, "temperature": "hot"|"warm"|"cold", "intent": "one short sentence on what they want and how ready they are", ' +
  '"summary": "one short sentence", "follow_up": ["2-4 short, concrete next steps for the owner"]}. ' +
  "Hot = ready to buy or urgent, warm = interested but undecided, cold = browsing, spam or irrelevant. South African English, no emojis.";

function normaliseIntent(parsed: any) {
  const score = Math.min(10, Math.max(1, Math.round(Number(parsed.score) || 1)));
  const temperature: "hot" | "warm" | "cold" = ["hot", "warm", "cold"].includes(parsed.temperature)
    ? parsed.temperature
    : score >= 8 ? "hot" : score >= 5 ? "warm" : "cold";
  return {
    score,
    temperature,
    intent: String(parsed.intent ?? "").slice(0, 300),
    summary: String(parsed.summary ?? "").slice(0, 300),
    followUp: (Array.isArray(parsed.follow_up) ? parsed.follow_up : []).slice(0, 5).map((s: unknown) => String(s).slice(0, 200)),
  };
}

/** Assess a pasted WhatsApp conversation (not tied to a saved lead). */
export const analyzeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversation: z.string().trim().min(10).max(12000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: tenant } = await context.supabase.from("tenants").select("id").eq("owner_id", context.userId).maybeSingle();
    const { data: profile } = tenant
      ? await context.supabase.from("business_profiles").select("business_name, industry, services").eq("tenant_id", tenant.id).maybeSingle()
      : { data: null };
    const raw = await chat([
      { role: "system", content: INTENT_SYSTEM },
      {
        role: "user",
        content: `Business: ${profile?.business_name || "Unknown"} (${profile?.industry || "services"}). Services: ${profile?.services || "n/a"}.\n\nConversation:\n${data.conversation}`,
      },
    ]);
    return normaliseIntent(extractJson(raw));
  });

function extractJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("AI returned an unexpected answer.");
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Score a lead 1-10 (hot/warm/cold) from its WhatsApp conversation. */
export const scoreLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: lead, error } = await sb
      .from("leads")
      .select("id, tenant_id, name, phone, status, conversation_messages(direction, body, created_at)")
      .eq("id", data.leadId)
      .single();
    if (error || !lead) throw new Error("Lead not found");

    const msgs = ((lead as any).conversation_messages ?? [])
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .slice(-25)
      .map((m: any) => `${m.direction === "inbound" ? "Customer" : "Business"}: ${m.body}`)
      .join("\n");
    if (!msgs) throw new Error("This lead has no messages to score yet.");

    const { data: profile } = await sb
      .from("business_profiles")
      .select("business_name, industry, trade, services")
      .eq("tenant_id", lead.tenant_id)
      .maybeSingle();

    const raw = await chat([
      { role: "system", content: INTENT_SYSTEM },
      {
        role: "user",
        content: `Business: ${profile?.business_name || "Unknown"} (${profile?.industry || profile?.trade || "services"}). Services: ${profile?.services || "n/a"}.\n\nConversation:\n${msgs}`,
      },
    ]);
    const r = normaliseIntent(extractJson(raw));
    const stored = [r.summary, r.followUp.length ? `Next: ${r.followUp.join("; ")}` : ""].filter(Boolean).join(" ").slice(0, 600);

    await sb
      .from("leads")
      .update({ ai_score: r.score, ai_temperature: r.temperature, ai_summary: stored, ai_scored_at: new Date().toISOString() })
      .eq("id", lead.id);
    return r;
  });

/** Generate landing-page copy for the tenant's public business site. */
export const generateSiteCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tone: z.enum(["friendly", "professional", "bold"]).default("friendly") }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: tenant } = await sb.from("tenants").select("id").eq("owner_id", context.userId).single();
    if (!tenant) throw new Error("Workspace not found");
    const { data: profile } = await sb.from("business_profiles").select("*").eq("tenant_id", tenant.id).maybeSingle();
    if (!profile?.business_name) throw new Error("Add your business name in Settings first.");

    const raw = await chat([
      {
        role: "system",
        content:
          "You write conversion-focused landing page copy for small South African service businesses. " +
          "South African English, plain words, no jargon, no emojis. Reply with JSON only: " +
          '{"headline":"","subheadline":"","about":"","services":[{"name":"","description":""}],"faqs":[{"q":"","a":""}],"cta_text":""}. ' +
          "Give 4 services and 4 FAQs.",
      },
      {
        role: "user",
        content: `Business: ${profile.business_name}. Trade: ${profile.industry || profile.trade}. Area: ${profile.suburb ?? "South Africa"}. Services: ${profile.services || "general"}. Pricing notes: ${profile.pricing_notes || "n/a"}. Tone: ${data.tone}.`,
      },
    ]);
    const c = extractJson(raw);
    return {
      headline: String(c.headline ?? "").slice(0, 160),
      subheadline: String(c.subheadline ?? "").slice(0, 300),
      about: String(c.about ?? "").slice(0, 1200),
      services: Array.isArray(c.services) ? c.services.slice(0, 8) : [],
      faqs: Array.isArray(c.faqs) ? c.faqs.slice(0, 8) : [],
      cta_text: String(c.cta_text ?? "Get a free quote on WhatsApp").slice(0, 80),
    };
  });

const REPLY_SYSTEM =
  "You write WhatsApp replies for a South African service business owner to send to a lead. " +
  "First judge purchase intent, then write ONE reply that matches it: hot = confirm availability fast and propose a concrete next step (time slot, call-out, quote); " +
  "warm = answer their question, mention the most relevant service and ask one qualifying question; cold = friendly, short, leave the door open. " +
  "Only mention services the business actually offers. Never invent prices unless given in pricing notes. Keep it under 90 words, warm and personal, use the customer's name if known. " +
  "South African English, WhatsApp style, no emojis, no markdown. " +
  'Reply with JSON only: {"score": 1-10, "temperature": "hot"|"warm"|"cold", "reasoning": "one short sentence on why this reply", "reply": "the message text"}.';

/** Draft a personalised WhatsApp reply from a pasted chat or a saved lead's thread. */
export const draftReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ conversation: z.string().trim().min(10).max(12000).optional(), leadId: z.string().uuid().optional() })
      .refine((v) => v.conversation || v.leadId, "Provide a conversation")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    let convo = data.conversation ?? "";
    let tenantId: string | null = null;
    let leadName: string | null = null;
    if (data.leadId) {
      const { data: lead } = await sb
        .from("leads")
        .select("tenant_id, name, conversation_messages(direction, body, created_at)")
        .eq("id", data.leadId)
        .single();
      if (!lead) throw new Error("Lead not found");
      tenantId = lead.tenant_id;
      leadName = lead.name;
      convo = ((lead as any).conversation_messages ?? [])
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .slice(-25)
        .map((m: any) => `${m.direction === "inbound" ? "Customer" : "Business"}: ${m.body}`)
        .join("\n");
      if (!convo) throw new Error("This lead has no messages yet.");
    } else {
      const { data: t } = await sb.from("tenants").select("id").eq("owner_id", context.userId).maybeSingle();
      tenantId = t?.id ?? null;
    }
    const { data: p } = tenantId
      ? await sb.from("business_profiles").select("business_name, industry, trade, services, pricing_notes, suburb").eq("tenant_id", tenantId).maybeSingle()
      : { data: null };
    const raw = await chat([
      { role: "system", content: REPLY_SYSTEM },
      {
        role: "user",
        content: `Business: ${p?.business_name || "our business"} (${p?.industry || p?.trade || "services"}), area: ${p?.suburb || "South Africa"}. Services: ${p?.services || "n/a"}. Pricing notes: ${p?.pricing_notes || "none"}.${leadName ? ` Customer name: ${leadName}.` : ""}\n\nConversation:\n${convo}`,
      },
    ]);
    const j = extractJson(raw);
    const n = normaliseIntent(j);
    const reply = String(j.reply ?? "").trim().slice(0, 1000);
    if (!reply) throw new Error("The AI returned no reply. Please try again.");
    return { score: n.score, temperature: n.temperature, reasoning: String(j.reasoning ?? "").slice(0, 300), reply };
  });
