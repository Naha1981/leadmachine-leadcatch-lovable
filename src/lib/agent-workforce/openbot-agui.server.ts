import { z } from "zod";

const AGENT_TOKEN_HEADER = "x-openbot-agent-token";
const agentTokenSchema = z.string().trim().min(1).max(4096);
const threadIdSchema = z.string().trim().min(1).max(200);
const runIdSchema = z.string().trim().min(1).max(200);

export type AgentRunMessage = {
  id: string;
  role: "system" | "developer" | "user" | "assistant" | "tool";
  content: string;
};

export type OpenBotAgUiRunInput = {
  threadId: string;
  runId: string;
  messages: AgentRunMessage[];
  state?: Record<string, unknown>;
  context?: Array<Record<string, unknown>>;
  forwardedProps?: Record<string, unknown>;
};

export type OpenBotAgUiResult = {
  threadId: string;
  runId: string;
  status: "completed" | "failed" | "outcome_unknown";
  outputText: string;
  eventCount: number;
  lastEventType: string | null;
};

function requireUrl(input: string, name: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error(name + " must be a valid HTTP(S) URL."); }
  if (![ "http:", "https:" ].includes(url.protocol) || url.username || url.password) {
    throw new Error(name + " must be an HTTP(S) URL without embedded credentials.");
  }
  return url;
}

function env(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function parseJsonLine(payload: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

function textFromEvent(event: Record<string, unknown>) {
  const type = String(event["type"] ?? "");
  if (!/TEXT_MESSAGE_CONTENT|MESSAGE_CONTENT|TEXT_MESSAGE/i.test(type)) return "";
  const candidates = [
    event["delta"],
    event["content"],
    event["text"],
    (event["message"] as Record<string, unknown> | undefined)?.["content"],
  ];
  for (const value of candidates) if (typeof value === "string" && value) return value;
  return "";
}

async function consumeSse(response: Response) {
  if (!response.body) throw new Error("OpenBot returned an empty AG-UI stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";
  let eventCount = 0;
  let lastEventType: string | null = null;
  let status: OpenBotAgUiResult["status"] = "completed";

  const flushEvent = (raw: string) => {
    const dataLines = raw.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter(Boolean);
    for (const data of dataLines) {
      if (data === "[DONE]") continue;
      const event = parseJsonLine(data);
      if (!event) continue;
      eventCount += 1;
      lastEventType = String(event["type"] ?? "unknown");
      outputText += textFromEvent(event);
      const type = String(event["type"] ?? "");
      if (/RUN_ERROR|RUN_FAILED|ERROR/i.test(type)) status = "failed";
      if (/RUN_FINISHED|RUN_COMPLETED|RUN_SUCCESS/i.test(type) && status !== "failed") status = "completed";
    }
  };

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let match = buffer.match(/\r?\n\r?\n/);
    while (match && match.index !== undefined) {
      const raw = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      flushEvent(raw);
      match = buffer.match(/\r?\n\r?\n/);
    }
  }
  if (buffer.trim()) flushEvent(buffer);
  return { outputText: outputText.trim(), eventCount, lastEventType, status };
}

function buildInput(input: OpenBotAgUiRunInput) {
  return {
    threadId: threadIdSchema.parse(input.threadId),
    runId: runIdSchema.parse(input.runId),
    state: input.state ?? {},
    messages: input.messages,
    tools: [],
    context: input.context ?? [],
    forwardedProps: { ...(input.forwardedProps ?? {}) },
  };
}

export async function runOpenBotAgUi(input: OpenBotAgUiRunInput): Promise<OpenBotAgUiResult> {
  const base = env("OPENBOT_AGUI_URL");
  const token = env("OPENBOT_AGENT_TOKEN");
  if (!base || !token) throw new Error("OpenBot AG-UI is not configured.");
  const baseUrl = requireUrl(base, "OPENBOT_AGUI_URL");
  const agentToken = agentTokenSchema.parse(token);
  const endpoint = new URL("/ag-ui", baseUrl).toString();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json", [AGENT_TOKEN_HEADER]: agentToken },
      body: JSON.stringify(buildInput(input)),
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    throw new Error("OpenBot AG-UI could not be reached: " + (error instanceof Error ? error.message : "network error"));
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status >= 500 || response.status === 408) {
      throw new Error("OpenBot AG-UI outcome is unknown after HTTP " + response.status + (text ? ": " + text.slice(0, 500) : "."));
    }
    throw new Error("OpenBot AG-UI rejected the run (HTTP " + response.status + ")" + (text ? ": " + text.slice(0, 500) : "."));
  }
  try {
    const stream = await consumeSse(response);
    return { threadId: input.threadId, runId: input.runId, status: stream.status, outputText: stream.outputText, eventCount: stream.eventCount, lastEventType: stream.lastEventType };
  } catch (error) {
    throw new Error("OpenBot AG-UI stream outcome is unknown: " + (error instanceof Error ? error.message : "stream error"));
  }
}