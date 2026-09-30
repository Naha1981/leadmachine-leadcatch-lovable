import { sendText } from "@/lib/operator.server";

type RedditPost = {
  id: string;
  title?: string;
  selftext?: string;
  author?: string | null;
  subreddit?: string;
  permalink?: string;
  created_utc?: number;
};

export type DemandSignal = {
  tenantId: string;
  source: string;
  externalId: string;
  sourceName: string;
  sourceUrl: string;
  author: string | null;
  title: string;
  body: string;
  service: string;
  suburb: string | null;
  urgency: string;
  intentScore: number;
  matchedTerms: string[];
};

const INTENT_PATTERNS = [
  /looking for/i,
  /need(?:ing)?\s+(?:a|an|someone|somebody|help)/i,
  /can anyone recommend/i,
  /any recommendations/i,
  /recommend(?:ation)?s?/i,
  /anyone know/i,
  /where can i find/i,
  /who can/i,
  /help me find/i,
  /urgent/i,
  /emergency/i,
];

const URGENCY_PATTERNS: Array<[RegExp, string]> = [
  [/tonight|right now|asap|immediately/i, "Tonight"],
  [/today/i, "Today"],
  [/urgent|emergency/i, "Urgent"],
  [/tomorrow/i, "Tomorrow"],
];

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => clean(v).toLowerCase()).filter(Boolean)));
}

function buildServiceTerms(industry: string, services: string, explicit: unknown) {
  const fromExplicit = Array.isArray(explicit) ? explicit.map(String) : [];
  const fromServices = services
    .split(/[\n,|]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 6);
  return unique([...fromExplicit, industry, ...fromServices]).slice(0, 10);
}

function buildQueries(terms: string[], suburb: string | null) {
  const service = terms[0] || "service";
  const location = suburb ? ` ${suburb}` : "";
  return unique([
    `"looking for" ${service}${location}`,
    `"need" ${service}${location}`,
    `recommend ${service}${location}`,
    `${service}${location} urgent`,
  ]).slice(0, 4);
}

function scorePost(post: RedditPost, terms: string[], suburb: string | null) {
  const title = clean(post.title);
  const body = clean(post.selftext);
  const haystack = `${title} ${body}`.toLowerCase();
  const matched = terms.filter((term) => haystack.includes(term.toLowerCase()));
  const intentMatches = INTENT_PATTERNS.filter((pattern) => pattern.test(haystack)).length;
  const locationMatch = suburb ? haystack.includes(suburb.toLowerCase()) : false;
  const urgencyMatch = URGENCY_PATTERNS.find(([pattern]) => pattern.test(haystack))?.[1] ?? "Normal";

  let score = 2;
  if (matched.length) score += 3;
  if (intentMatches) score += Math.min(2, intentMatches);
  if (locationMatch) score += 1;
  if (urgencyMatch !== "Normal") score += 2;

  return {
    score: Math.min(10, score),
    matched,
    urgency: urgencyMatch,
    locationMatch,
  };
}

async function fetchReddit(query: string, subreddits: string[]) {
  const targets = subreddits.length ? subreddits : [""];
  const posts: RedditPost[] = [];
  const userAgent = process.env["DEMAND_RADAR_USER_AGENT"] || "LeadMachine-DemandRadar/1.0";

  for (const subreddit of targets) {
    const base = subreddit
      ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`
      : "https://www.reddit.com/search.json";
    const url = new URL(base);
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "new");
    url.searchParams.set("t", "day");
    url.searchParams.set("limit", "25");
    url.searchParams.set("restrict_sr", subreddit ? "on" : "off");

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": userAgent },
    });

    if (!response.ok) {
      console.error(`[DemandRadar] Reddit ${response.status}: ${url.toString()}`);
      continue;
    }

    const payload = (await response.json()) as {
      data?: { children?: Array<{ data?: RedditPost }> };
    };

    for (const child of payload.data?.children ?? []) {
      if (child.data?.id) posts.push(child.data);
    }
  }

  return posts;
}

function buildAlertText(signal: DemandSignal) {
  return [
    `🚨 NEW DEMAND SIGNAL — LeadMachine`,
    "",
    `${signal.service} · ${signal.suburb || "Local area"} · ${signal.urgency}`,
    `Intent score: ${signal.intentScore}/10`,
    "",
    `“${signal.body.slice(0, 900)}”`,
    "",
    `Source: ${signal.sourceName}`,
    signal.sourceUrl,
    "",
    "A customer is publicly looking for this service.",
    "Open the post and act while they are still looking.",
  ].join("\n");
}

async function alertOwner(db: any, signal: DemandSignal) {
  const { data: profile } = await db
    .from("business_profiles")
    .select("business_name, contact_phone, whatsapp_number, wa_account_id, whatsapp_status")
    .eq("tenant_id", signal.tenantId)
    .maybeSingle();

  const ownerPhone = profile?.contact_phone || profile?.whatsapp_number;
  if (!ownerPhone) return { whatsapp: false, sms: false, reason: "Owner phone not configured" };

  const text = buildAlertText(signal);
  let whatsapp = false;

  if (process.env["SIMULATE_WHATSAPP"] === "true") {
    whatsapp = true;
  } else if (profile?.whatsapp_status === "connected" && profile?.wa_account_id) {
    try {
      const sent = await sendText(signal.tenantId, profile.wa_account_id, ownerPhone, text);
      whatsapp = sent.ok !== false;
    } catch (error) {
      console.error("[DemandRadar] WhatsApp alert failed", error);
    }
  }

  let sms = false;
  const smsUrl = process.env["SMS_ALERT_WEBHOOK_URL"];
  if (process.env["SIMULATE_SMS"] === "true") {
    sms = true;
  } else if (smsUrl) {
    try {
      const response = await fetch(smsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env["SMS_ALERT_WEBHOOK_SECRET"]
            ? { "X-Lead-Machine-Secret": process.env["SMS_ALERT_WEBHOOK_SECRET"] }
            : {}),
        },
        body: JSON.stringify({
          event: "demand_radar.alert",
          tenantId: signal.tenantId,
          to: ownerPhone,
          message: text,
        }),
      });
      sms = response.ok;
    } catch (error) {
      console.error("[DemandRadar] SMS alert failed", error);
    }
  }

  return { whatsapp, sms, text };
}

async function loadTenants(db: any) {
  const { data, error } = await db
    .from("business_profiles")
    .select("tenant_id, business_name, industry, services, suburb, demand_radar_enabled, demand_radar_terms, demand_radar_subreddits")
    .eq("demand_radar_enabled", true)
    .neq("industry", "");

  if (error) throw error;
  return data ?? [];
}

export async function processDemandRadar(limit = 25) {
  const { supabaseAdmin: rawDb } = await import("@/integrations/supabase/client.server");
  const db = rawDb as any;
  const tenants = (await loadTenants(db)).slice(0, limit);
  let discovered = 0;
  let alerted = 0;

  for (const tenant of tenants) {
    const suburb = clean(tenant.suburb) || null;
    const terms = buildServiceTerms(clean(tenant.industry), clean(tenant.services), tenant.demand_radar_terms);
    const subreddits = Array.isArray(tenant.demand_radar_subreddits)
      ? (tenant.demand_radar_subreddits as unknown[]).map((v: unknown) => String(v).replace(/^r\//i, "").trim()).filter(Boolean).slice(0, 5)
      : [];
    const queries = buildQueries(terms, suburb);

    for (const query of queries) {
      const posts = await fetchReddit(query, subreddits);

      for (const post of posts) {
        const title = clean(post.title);
        const body = clean(post.selftext);
        if (!title && !body) continue;

        const combined = `${title} ${body}`;
        if (!INTENT_PATTERNS.some((pattern) => pattern.test(combined))) continue;

        const result = scorePost(post, terms, suburb);
        if (result.score < 6) continue;

        const sourceName = post.subreddit ? `r/${post.subreddit}` : "Reddit";
        const sourceUrl = `https://www.reddit.com${post.permalink || ""}`;
        const externalId = post.id;
        const signal: DemandSignal = {
          tenantId: tenant.tenant_id,
          source: "reddit",
          externalId,
          sourceName,
          sourceUrl,
          author: post.author ?? null,
          title,
          body: body || title,
          service: terms.find((term) => combined.toLowerCase().includes(term.toLowerCase())) || clean(tenant.industry) || "Service",
          suburb,
          urgency: result.urgency,
          intentScore: result.score,
          matchedTerms: result.matched,
        };

        const inserted = await db
          .from("demand_radar_signals")
          .insert({
            tenant_id: signal.tenantId,
            source: signal.source,
            external_id: signal.externalId,
            source_name: signal.sourceName,
            source_url: signal.sourceUrl,
            author: signal.author,
            title: signal.title,
            body: signal.body,
            service: signal.service,
            suburb: signal.suburb,
            urgency: signal.urgency,
            intent_score: signal.intentScore,
            matched_terms: signal.matchedTerms,
          })
          .select("id")
          .maybeSingle();

        if (inserted.error?.code === "23505") continue;
        if (inserted.error) throw inserted.error;
        if (!inserted.data) continue;

        discovered += 1;
        const alert = await alertOwner(db, signal);
        const channelCount = Number(alert.whatsapp) + Number(alert.sms);

        if (channelCount > 0) {
          await db.from("demand_radar_signals").update({
            status: "alerted",
            alerted_at: new Date().toISOString(),
            alert_channels: { whatsapp: alert.whatsapp, sms: alert.sms },
          }).eq("id", inserted.data.id);


          alerted += 1;
        }
      }
    }
  }

  return { tenants: tenants.length, discovered, alerted };
}
