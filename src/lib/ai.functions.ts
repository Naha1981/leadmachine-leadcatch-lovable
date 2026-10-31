import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Non-streaming chat through Groq's OpenAI-compatible API (free tier). Returns the reply text. */
async function chatGroq(messages: Array<{ role: string; content: string }>, maxTokens: number): Promise<string> {
  const key = process.env["GROQ_API_KEY"]?.trim();
  if (!key) throw new Error("Groq is not configured.");
  const model = process.env["GROQ_MODEL"]?.trim() || GROQ_DEFAULT_MODEL;
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_completion_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("Groq returned no content");
  return text;
}

/** Non-streaming chat through Gemini's generateContent API (free tier). Returns the reply text. */
async function chatGemini(messages: Array<{ role: string; content: string }>, maxTokens: number): Promise<string> {
  const key = process.env["GEMINI_API_KEY"]?.trim();
  if (!key) throw new Error("Gemini is not configured.");
  const model = process.env["GEMINI_AGENT_MODEL"]?.trim() || "gemini-3.8-flash";
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const turns = messages.filter((m) => m.role !== "system");
  const res = await fetch(`${GEMINI_GENERATE_URL}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: turns.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = (body?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("");
  if (typeof text !== "string" || !text.trim()) throw new Error("Gemini returned no content");
  return text;
}

/** Provider chain for customer-facing AI: Groq (free tier) first, Gemini (free tier) as fallback, then the Lovable gateway. */
async function chat(messages: Array<{ role: string; content: string }>, maxTokens = 900): Promise<string> {
  try {
    return await chatGroq(messages, maxTokens);
  } catch (e) {
    console.error("Groq chat failed, falling back to Gemini:", e instanceof Error ? e.message : e);
  }
  try {
    return await chatGemini(messages, maxTokens);
  } catch (e) {
    console.error("Gemini chat failed, falling back to Lovable gateway:", e instanceof Error ? e.message : e);
  }
  return chatLovableGateway(messages, maxTokens);
}

/** Streams a Responses call through the Lovable AI Gateway and returns the final text. */
async function chatLovableGateway(messages: Array<{ role: string; content: string }>, _maxTokens = 900): Promise<string> {
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
          "You write conversion-focused landing page copy for a specific South African service-business industry. " +
          "Make the copy unmistakably about that trade: use its real customer problems, service terminology, buying triggers and decision questions. " +
          "Do not write generic small-business or generic AI copy. South African English, plain words, no jargon, no emojis. Reply with JSON only: " +
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
  "You write WhatsApp replies as a real person working at a South African service business - like someone at the plumber's own office, not a company or an AI assistant. " +
  "Write 1-3 short sentences that sound natural and realistic, the way people actually text on WhatsApp: plain words, no corporate phrases (never 'reach out', 'assist you further', 'do not hesitate', 'we value your enquiry'). " +
  "First judge purchase intent, then write ONE reply that matches it: hot = confirm you can help and propose a concrete next step (time slot, call-out, quote); " +
  "warm = answer their question and ask the one thing you still need to know; cold = friendly and short, leave the door open. " +
  "Only mention services the business actually offers. PRICE RULE: never state or estimate any price, fee, rate, range or call-out cost unless the business's own pricing notes give that exact figure. If the customer asks about price and no pricing notes cover it, do not give a number - say the plumber will confirm the exact price once they have the job details, and ask for the details needed (photos, address, problem description). " +
  "Keep it under 60 words, warm and personal, use the customer's name if known. " +
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
    let reply = String(j.reply ?? "").trim().slice(0, 1000);
    const hasPricingNotes = !!(p?.pricing_notes && String(p.pricing_notes).trim());
    const pricePattern = /(R\s?\d|\d+[\s-]*(rand|zar)|R[\d,]+(?:\.\d{2})?\s?[-–]\s?R?[\d,]+)/i;
    if (!hasPricingNotes && pricePattern.test(reply)) {
      const retry = await chat([
        { role: "system", content: REPLY_SYSTEM + " Your previous draft stated a price, which is not allowed without pricing notes. Rewrite without any numbers about cost." },
        {
          role: "user",
          content: `Business: ${p?.business_name || "our business"} (${p?.industry || p?.trade || "services"}), area: ${p?.suburb || "South Africa"}. Services: ${p?.services || "n/a"}. Pricing notes: none.${leadName ? ` Customer name: ${leadName}.` : ""}\n\nConversation:\n${convo}`,
        },
      ], 300);
      try {
        const j2 = extractJson(retry);
        const reply2 = String(j2.reply ?? "").trim().slice(0, 1000);
        if (reply2 && !pricePattern.test(reply2)) {
          reply = reply2;
        } else {
          // Last resort: remove sentences that mention a price.
          reply = reply
            .split(/(?<=[.!?])\s+/)
            .filter((sent) => !pricePattern.test(sent))
            .join(" ")
            .trim();
        }
      } catch {
        reply = reply
          .split(/(?<=[.!?])\s+/)
          .filter((sent) => !pricePattern.test(sent))
          .join(" ")
          .trim();
      }
    }
    if (!reply) throw new Error("The AI returned no reply. Please try again.");
    if (data.leadId) {
      await sb
        .from("leads")
        .update({ ai_score: n.score, ai_temperature: n.temperature, ai_summary: String(j.reasoning ?? "").slice(0, 600), ai_scored_at: new Date().toISOString() })
        .eq("id", data.leadId);
    }
    return { score: n.score, temperature: n.temperature, reasoning: String(j.reasoning ?? "").slice(0, 300), reply };
  });

const FOLLOWUP_SYSTEM =
  "You write WhatsApp follow-up messages as a real person at a South African service business, for the owner to send to a lead. " +
  "Use the lead's details, the conversation context and the business's services. Sound like a human texting, not a company: 1-3 short sentences, natural WhatsApp tone, no corporate phrasing. " +
  "Reference what the customer asked about, and end with one clear, easy next step. South African English, no emojis, no markdown. " +
  'Reply with JSON only: {"temperature": "hot"|"warm"|"cold", "reasoning": "one short sentence on the approach", "message": "the WhatsApp message"}.';

/** Draft a personalised WhatsApp follow-up from a lead's details and context. */
export const draftFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        leadName: z.string().trim().min(1).max(80),
        service: z.string().trim().max(200).optional().default(""),
        lastContact: z.string().trim().max(80).optional().default(""),
        goal: z.string().trim().max(200).optional().default(""),
        context: z.string().trim().min(5).max(6000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: t } = await sb.from("tenants").select("id").eq("owner_id", context.userId).maybeSingle();
    const { data: p } = t?.id
      ? await sb.from("business_profiles").select("business_name, industry, trade, services, pricing_notes, suburb").eq("tenant_id", t.id).maybeSingle()
      : { data: null };
    const raw = await chat([
      { role: "system", content: FOLLOWUP_SYSTEM },
      {
        role: "user",
        content:
          `Business: ${p?.business_name || "our business"} (${p?.industry || p?.trade || "services"}), area: ${p?.suburb || "South Africa"}. ` +
          `Services: ${p?.services || "n/a"}. Pricing notes: ${p?.pricing_notes || "none"}.\n` +
          `Lead: ${data.leadName}. Interested in: ${data.service || "not stated"}. Last contact: ${data.lastContact || "unknown"}. ` +
          `Owner's goal for this message: ${data.goal || "move them to the next step"}.\n\nContext:\n${data.context}`,
      },
    ], 250);
    const j = extractJson(raw);
    const message = String(j.message ?? "").trim().slice(0, 1000);
    if (!message) throw new Error("The AI returned no message. Please try again.");
    const temperature: "hot" | "warm" | "cold" = ["hot", "warm", "cold"].includes(j.temperature) ? j.temperature : "warm";
    return { message, temperature, reasoning: String(j.reasoning ?? "").slice(0, 300) };
  });
