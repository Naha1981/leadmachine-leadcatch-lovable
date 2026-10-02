type Draft = {
  clusterKey: string;
  title: string;
  summary: string;
  observedClaim: string;
  inference: string;
  recommendedAction: string;
};

async function callLovableAI(prompt: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env["MARKET_INTELLIGENCE_MODEL"] || "openai/gpt-6-astra",
      input: [
        { role: "system", content: "You synthesize evidence for business intelligence. Never invent sources or consensus. Observed claim states only what the supplied evidence supports. Inference is explicitly framed as inference. Return JSON only with findings: clusterKey,title,summary,observedClaim,inference,recommendedAction. Use concise South African English." },
        { role: "user", content: prompt },
      ],
      stream: false,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("AI gateway returned " + response.status);
  const body = await response.json() as any;
  const text = body.output_text || body.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === "output_text")?.text || "";
  if (!text) throw new Error("AI returned no output");
  return text;
}

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("AI JSON output missing");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function synthesizeFindings(groups: Array<{
  clusterKey: string;
  category: string;
  evidence: Array<{ title: string; sourceType: string; sourceUrl: string; text: string }>;
}>): Promise<Draft[]> {
  if (!groups.length) return [];
  const compact = groups.slice(0, 30).map((group) => ({
    clusterKey: group.clusterKey,
    category: group.category,
    evidence: group.evidence.slice(0, 5).map((item) => ({
      title: item.title,
      sourceType: item.sourceType,
      sourceUrl: item.sourceUrl,
      text: item.text.slice(0, 900),
    })),
  }));
  try {
    const raw = await callLovableAI(JSON.stringify(compact));
    const parsed = extractJson(raw);
    return Array.isArray(parsed.findings)
      ? parsed.findings.filter((item: any) => item?.clusterKey && item?.title && item?.observedClaim).map((item: any) => ({
          clusterKey: String(item.clusterKey).slice(0, 160),
          title: String(item.title).slice(0, 180),
          summary: String(item.summary ?? "").slice(0, 500),
          observedClaim: String(item.observedClaim).slice(0, 600),
          inference: String(item.inference ?? "Inference unavailable.").slice(0, 600),
          recommendedAction: String(item.recommendedAction ?? "Review the evidence and decide on an appropriate response.").slice(0, 600),
        }))
      : [];
  } catch (error) {
    console.error("[MarketIntelligence] AI synthesis failed; using deterministic summaries", error);
    return [];
  }
}
