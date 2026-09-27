import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function chat(messages: Array<{ role: string; content: string }>, maxTokens = 900): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured yet.");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens }),
  });
  if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits have run out. Top up to keep using AI features.");
  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text().catch(() => ""));
    throw new Error("The AI service could not be reached.");
  }
  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

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

    const raw = await chat(
      [
        {
          role: "system",
          content:
            "You qualify inbound WhatsApp leads for a South African service business. " +
            "Reply with JSON only: {\"score\": 1-10, \"temperature\": \"hot\"|\"warm\"|\"cold\", \"summary\": \"one short sentence\"}. " +
            "Hot = ready to buy or urgent, warm = interested but undecided, cold = browsing, spam or irrelevant.",
        },
        {
          role: "user",
          content: `Business: ${profile?.business_name || "Unknown"} (${profile?.industry || profile?.trade || "services"}). Services: ${profile?.services || "n/a"}.\n\nConversation:\n${msgs}`,
        },
      ],
      200,
    );
    const parsed = extractJson(raw);
    const score = Math.min(10, Math.max(1, Math.round(Number(parsed.score) || 1)));
    const temperature = ["hot", "warm", "cold"].includes(parsed.temperature) ? parsed.temperature : score >= 8 ? "hot" : score >= 5 ? "warm" : "cold";
    const summary = String(parsed.summary ?? "").slice(0, 300);

    await sb
      .from("leads")
      .update({ ai_score: score, ai_temperature: temperature, ai_summary: summary, ai_scored_at: new Date().toISOString() })
      .eq("id", lead.id);
    return { score, temperature, summary };
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
