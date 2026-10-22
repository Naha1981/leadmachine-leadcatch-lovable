// Server-side client for the NahaLabs AI assistant API (per-tenant key).
// A tenant can paste their own key in Settings; the assistant features then
// run on their account, with its budgets and approval gates. The key is
// stored in public.tenant_integrations, which is service_role only.
const HI_BASE = "https://hi.nahalabs.co.za";
export const HI_PROVIDER = "nahalabs-ai";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Verify a key against the live API. Returns a short label (agent name) when valid. */
export async function verifyHiKey(key: string): Promise<{ label: string | null }> {
  const res = await fetch(`${HI_BASE}/v1/agents`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 || res.status === 403)
    throw new Error("That key was rejected. Check it and try again.");
  if (!res.ok) throw new Error("The AI service could not be reached. Try again shortly.");
  const body = await res.json().catch(() => ({}));
  const list = Array.isArray(body) ? body : (body.agents ?? body.items ?? []);
  const first = list[0];
  const label =
    typeof first?.name === "string" && first.name.trim() ? first.name.trim().slice(0, 80) : null;
  return { label };
}

/** Look up the tenant's stored key. Returns null when not connected. */
export async function getHiConnection(
  tenantId: string,
): Promise<{ apiKey: string; label: string | null; verifiedAt: string | null } | null> {
  const { data, error } = await (
    await db()
  )
    .from("tenant_integrations")
    .select("api_key, external_label, verified_at, status")
    .eq("tenant_id", tenantId)
    .eq("provider", HI_PROVIDER)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "connected") return null;
  try {
    const { decryptSecret } = await import("./integration-secrets.server");
    const apiKey = await decryptSecret(tenantId, HI_PROVIDER, data.api_key as string);
    return { apiKey, label: data.external_label, verifiedAt: data.verified_at };
  } catch {
    // Fail closed: tampered, foreign-tenant or unreadable rows are never used.
    await (await db())
      .from("tenant_integrations")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("provider", HI_PROVIDER);
    return null;
  }
}

export async function saveHiConnection(
  tenantId: string,
  apiKey: string,
  label: string | null,
): Promise<void> {
  // Throws when secret storage is not configured: fail closed, nothing stored.
  const { encryptSecret } = await import("./integration-secrets.server");
  const stored = await encryptSecret(tenantId, HI_PROVIDER, apiKey);
  const { error } = await (await db()).from("tenant_integrations").upsert({
    tenant_id: tenantId,
    provider: HI_PROVIDER,
    api_key: stored,
    status: "connected",
    external_label: label,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function clearHiConnection(tenantId: string): Promise<void> {
  const { error } = await (
    await db()
  )
    .from("tenant_integrations")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("provider", HI_PROVIDER);
  if (error) throw error;
}

/** Chat via the tenant's assistant. Throws on failure so callers can fall back. */
export async function hiChat(
  apiKey: string,
  messages: ChatMessage[],
): Promise<{ text: string; provider: string; model: string }> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) throw new Error("No user message");
  const message = system ? `${system}\n\n${lastUser.content}` : lastUser.content;
  const res = await fetch(`${HI_BASE}/v1/chat`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ message: message.slice(0, 4000) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Assistant API error ${res.status}`);
  const body = await res.json().catch(() => ({}));
  const text =
    typeof body.answer === "string" ? body.answer : typeof body.text === "string" ? body.text : "";
  if (!text.trim()) throw new Error("Assistant returned no content");
  return { text, provider: "nahalabs-ai", model: "hi" };
}
