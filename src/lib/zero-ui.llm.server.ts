type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ChatResult = {
  text: string;
  provider: string;
  model: string;
};

async function chatNahaLLM(messages: ChatMessage[]): Promise<ChatResult> {
  const base = process.env["NAHALLM_URL"];
  const key = process.env["NAHALLM_API_KEY"];
  if (!base || !key) throw new Error("NahaLLM not configured");
  const model = process.env["NAHALLM_MODEL"] || "fast";
  const res = await fetch(base.replace(/\/$/, "") + "/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0, stream: false }),
  });
  if (!res.ok) throw new Error("NahaLLM error " + res.status);
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("NahaLLM returned no content");
  return { text, provider: "nahallm", model };
}

async function chatExistingGateway(messages: ChatMessage[]): Promise<ChatResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("No Zero UI LLM provider configured");
  const model = "openai/gpt-6-astra";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: messages, stream: false, store: false }),
  });
  if (!res.ok) throw new Error("Existing AI gateway error " + res.status);
  const body = await res.json();
  const text = body.output_text ?? body.output?.map?.((x: any) => x?.content?.map?.((c: any) => c?.text ?? "").join("") ?? "").join("") ?? "";
  if (typeof text !== "string" || !text.trim()) throw new Error("AI gateway returned no content");
  return { text, provider: "existing-gateway", model };
}

export async function zeroUiChat(messages: ChatMessage[]): Promise<ChatResult> {
  try {
    return await chatNahaLLM(messages);
  } catch {
    return chatExistingGateway(messages);
  }
}
