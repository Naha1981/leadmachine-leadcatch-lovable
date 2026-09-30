
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EvidenceItem, RuntimeStatus, SalesWorkerResult, WorkerFinding } from "./agent-workforce/contracts";

const Input = z.object({
  businessName: z.string().trim().min(1).max(120),
  websiteUrl: z.string().trim().url().max(2048),
  location: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
});

function assertPublicResearchUrl(input: string) {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only public HTTP(S) websites can be researched.");
  const host = url.hostname.toLowerCase();
  const blockedNames = ["localhost", "metadata.google.internal", "host.docker.internal"];
  if (blockedNames.includes(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Private or internal destinations are not allowed.");
  }

  const ipv4 = host.match(/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (
      octets.some((n) => n > 255) ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254)
    ) {
      throw new Error("Private or link-local destinations are not allowed.");
    }
  }
  return url;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.trim() ?? "";
}

function absoluteUrl(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

async function probeRuntime(kind: "openmuse" | "openbot"): Promise<RuntimeStatus> {
  const base = kind === "openmuse" ? process.env["OPENMUSE_BASE_URL"] : process.env["OPENBOT_BASE_URL"];
  if (!base) {
    return {
      kind,
      configured: false,
      reachable: false,
      capabilities: [],
      message: "Not configured — direct public-page research will be used in this environment.",
    };
  }

  const url =
    kind === "openmuse"
      ? new URL("/api/health", base).toString()
      : new URL("/api/copilotkit/info", base).toString();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        kind,
        configured: true,
        reachable: false,
        capabilities: [],
        message: "Configured but health check returned HTTP " + response.status + ".",
      };
    }

    const data = await response.json().catch(() => ({}));
    const capabilities =
      kind === "openmuse"
        ? ["agent workspace", "browser", "durable tasks"]
        : ["agent runtime", "computer gateway", "human handover"];

    return {
      kind,
      configured: true,
      reachable: true,
      capabilities,
      message:
        kind === "openmuse"
          ? "OpenMuse API is reachable (" + String(data?.mode ?? "unknown") + " mode)."
          : "OpenBot runtime discovery endpoint is reachable.",
    };
  } catch {
    return {
      kind,
      configured: true,
      reachable: false,
      capabilities: [],
      message: "Configured but unreachable from LeadMachine.",
    };
  }
}

async function inspectWebsite(input: z.infer<typeof Input>) {
  const researchUrl = assertPublicResearchUrl(input.websiteUrl);
  const response = await fetch(researchUrl.toString(), {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: {
      "user-agent": "NahaLabs-LeadMachine-Research/1.0 (+https://nahalabs.co.za)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) throw new Error("Website returned HTTP " + response.status + ".");
  const finalUrl = response.url || researchUrl.toString();
  if (new URL(finalUrl).hostname !== researchUrl.hostname) {
    throw new Error("The destination changed during research; rerun with the final public URL.");
  }
  const html = (await response.text()).slice(0, 600_000);
  const text = stripHtml(html).slice(0, 35_000);

  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );

  const links = Array.from(
    html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  )
    .slice(0, 80)
    .map((m) => ({ href: absoluteUrl(finalUrl, m[1]), label: stripHtml(m[2]).slice(0, 120) }))
    .filter((x) => x.href.startsWith("http"));

  const lower = (html + " " + text).toLowerCase();
  const hasWhatsApp = /whatsapp|wa\.me/.test(lower);
  const hasPhone = /(tel:|\+27|0\d{2}[\s-]\d{3}[\s-]\d{4})/.test(lower);
  const hasEmail = /mailto:|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(lower);
  const hasForm = /<form\b/i.test(html);
  const hasQuoteLanguage = /quote|quotation|book now|request|enquir|contact us|get started|call us/i.test(text);
  const hasPricing = /price|pricing|rates|from r\s?\d/i.test(text);
  const hasBusinessLocation = input.location
    ? text.toLowerCase().includes(input.location.toLowerCase())
    : false;

  const evidence: EvidenceItem[] = [];
  const observedAt = new Date().toISOString();

  const add = (title: string, detail: string) => {
    const id = "ev-" + (evidence.length + 1);
    evidence.push({
      id,
      label: "SOURCE-BACKED",
      title,
      detail,
      sourceUrl: finalUrl,
      observedAt,
    });
    return id;
  };

  const ctaId = add(
    "Commercial CTA language",
    hasQuoteLanguage
      ? "CTA or lead language was detected in the page text."
      : "No obvious quote, booking, enquiry or contact CTA language was detected in the fetched page text.",
  );
  const whatsappId = add(
    "WhatsApp channel",
    hasWhatsApp
      ? "A WhatsApp reference or link was detected on the fetched page."
      : "No WhatsApp reference or link was detected on the fetched page.",
  );
  const phoneId = add(
    "Phone channel",
    hasPhone
      ? "A phone or tel reference was detected on the fetched page."
      : "No phone or tel reference was detected on the fetched page.",
  );
  const emailId = add(
    "Email channel",
    hasEmail
      ? "An email address or mail link was detected on the fetched page."
      : "No email address or mail link was detected on the fetched page.",
  );
  const formId = add(
    "Enquiry form",
    hasForm ? "At least one HTML form was detected." : "No HTML form was detected.",
  );
  const pricingId = add(
    "Pricing visibility",
    hasPricing ? "Pricing or rates language was detected." : "No explicit pricing or rates language was detected.",
  );
  const locationId = add(
    "Location relevance",
    input.location
      ? hasBusinessLocation
        ? "The page text contains the supplied location: " + input.location + "."
        : "The supplied location " + input.location + " was not found in the fetched page text."
      : "No location was supplied for the scan.",
  );

  const titleId = add("Page title", title || "(No HTML title detected)");
  void titleId;
  void locationId;
  void links;
  void description;

  const findings: WorkerFinding[] = [];
  const finding = (
    severity: WorkerFinding["severity"],
    title: string,
    detail: string,
    evidenceIds: string[],
  ) => {
    findings.push({
      id: "finding-" + (findings.length + 1),
      severity,
      title,
      detail,
      evidenceIds,
    });
  };

  if (!hasWhatsApp && !hasForm && !hasPhone) {
    finding(
      "opportunity",
      "Lead capture path may be thin",
      "The fetched page exposes no detected WhatsApp link, enquiry form, or telephone link. This is a source-backed observation; the commercial impact is a proposal for validation, not a verified revenue loss.",
      [whatsappId, phoneId, formId],
    );
  } else if (!hasWhatsApp && !hasForm) {
    finding(
      "watch",
      "Primary enquiry path is limited",
      "The page has a contact signal but no detected WhatsApp link or HTML enquiry form. Test whether visitors have a clear low-friction path to start a conversation.",
      [whatsappId, formId, ctaId],
    );
  } else {
    finding(
      "info",
      "An enquiry mechanism is visible",
      "The fetched page exposes at least one detected conversion mechanism. This scan does not establish conversion quality.",
      [ctaId, formId, whatsappId, phoneId],
    );
  }

  if (!hasQuoteLanguage) {
    finding(
      "watch",
      "Action language is not obvious",
      "No obvious quote, booking, enquiry or contact CTA language was detected in the fetched page text. Validate the primary call-to-action manually.",
      [ctaId],
    );
  }

  if (!hasPricing) {
    finding(
      "watch",
      "Pricing visibility is unclear",
      "No explicit pricing or rates language was detected. Whether this is desirable depends on the business model and sales process.",
      [pricingId],
    );
  }

  const runtimes = await Promise.all([probeRuntime("openmuse"), probeRuntime("openbot")]);

  return {
    evidence,
    findings,
    runtimes,
    liveRuntime: runtimes.some((runtime) => runtime.reachable),
  };
}

async function runOpenBotAgent(input: {
  agentId: string;
  prompt: string;
  signal?: AbortSignal;
}) {
  const base = process.env["OPENBOT_BASE_URL"];
  const token = process.env["OPENBOT_AGENT_TOKEN"];
  if (!base || !token) {
    throw new Error("OpenBot execution is not configured.");
  }

  const response = await fetch(
    new URL("/api/copilotkit/agent/" + encodeURIComponent(input.agentId) + "/run", base),
    {
      method: "POST",
      signal: input.signal,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        threadId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        messages: [{ role: "user", content: input.prompt }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error("OpenBot refused the worker run with HTTP " + response.status + ".");
  }

  return response;
}

export const runSalesWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }): Promise<SalesWorkerResult> => {
    const inspected = await inspectWebsite(data);

    return {
      runId: crypto.randomUUID(),
      mode: inspected.liveRuntime ? "live-runtime-check" : "public-research",
      completedAt: new Date().toISOString(),
      target: {
        businessName: data.businessName,
        websiteUrl: data.websiteUrl,
        location: data.location,
        category: data.category,
      },
      runtimes: inspected.runtimes,
      evidence: inspected.evidence,
      findings: inspected.findings,
      recommendedActions: inspected.findings.map((item) => ({
        title: item.title,
        detail: item.detail,
        approvalRequired: true,
      })),
      approvalRequired: true,
    };
  });
