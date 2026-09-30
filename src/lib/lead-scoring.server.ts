import { getVerticalPack, fallbackLeadScore } from "@/lib/vertical-packs";

type ScoreInput = {
  businessName: string;
  industry: string;
  services: string;
  leadName?: string | null;
  phone?: string | null;
  message: string;
};

function extractJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[\[{]/);
  if (start === -1) throw new Error("AI returned an unexpected answer.");
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function chat(prompt: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: [
        {
          role: "system",
          content:
            "You qualify inbound leads for South African service businesses. " +
            'Return JSON only: {"score":1-10,"temperature":"hot"|"warm"|"cold","summary":"one sentence","follow_up":["2-4 concrete next questions or actions"]}. ' +
            "Hot means urgent or clearly ready to buy. Warm means genuine interest needing follow-up. Cold means vague, spammy or poor fit. Never invent missing details.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      store: false,
    }),
  });
  if (!res.ok) throw new Error("AI gateway unavailable");
  const body = await res.json();
  const text = body.output_text ?? body.output?.map?.((x: any) => x?.content?.map?.((c: any) => c?.text ?? "").join("") ?? "").join("") ?? "";
  if (!text) throw new Error("AI returned no score");
  return text;
}

export async function scoreInboundLead(input: ScoreInput) {
  const fallback = fallbackLeadScore({
    industry: input.industry,
    message: input.message,
    phone: input.phone,
    service: input.services,
  });
  const pack = getVerticalPack(input.industry);
  try {
    const raw = await chat(
      [
        `Business: ${input.businessName} (${input.industry})`,
        `Services: ${input.services || "not specified"}`,
        `Vertical pack: ${pack?.label ?? "Generic"}`,
        pack ? `Qualification questions: ${pack.questions.map((q) => q.question).join(" | ")}` : "",
        `Lead: ${input.leadName ?? "Unknown"}`,
        `Phone: ${input.phone ?? "Unknown"}`,
        `Message: ${input.message || "(no message)"}`,
      ].filter(Boolean).join("\n"),
    );
    const j = extractJson(raw);
    const score = Math.min(10, Math.max(1, Math.round(Number(j.score) || fallback.score)));
    const temperature = ["hot", "warm", "cold"].includes(j.temperature)
      ? j.temperature
      : score >= 8 ? "hot" : score >= 5 ? "warm" : "cold";
    return {
      score,
      temperature,
      summary: String(j.summary ?? fallback.summary).slice(0, 600),
      followUp: Array.isArray(j.follow_up) ? j.follow_up.slice(0, 4).map((x: unknown) => String(x).slice(0, 200)) : fallback.followUp,
    };
  } catch {
    return fallback;
  }
}
