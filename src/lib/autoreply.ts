// Pure auto-reply decision logic. Shared by the webhook (server) and the
// Auto-Reply preview (client) so both behave identically.

export type KeywordRule = { id: string; keywords: string[]; reply: string; enabled: boolean };
export type WorkingHours = { days: number[]; start: string; end: string };
export type AutoReplyConfig = {
  enabled: boolean;
  greeting: string;
  questions: string[];
  keyword_rules: KeywordRule[];
  after_hours: string;
  handoff: string;
};

export const TIMEZONE = "Africa/Johannesburg";

export function isWithinHours(hours: WorkingHours, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  const hm = `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
  return hours.days.includes(day) && hm >= hours.start && hm < hours.end;
}

export function matchKeyword(rules: KeywordRule[], text: string): KeywordRule | null {
  const t = text.toLowerCase();
  for (const r of rules) {
    if (!r.enabled || !r.reply.trim()) continue;
    if (r.keywords.some((k) => k.trim() && t.includes(k.trim().toLowerCase()))) return r;
  }
  return null;
}

/**
 * Decide which messages to send in response to an inbound message.
 * @param inboundIndex 1-based count of inbound messages in this conversation, including this one.
 */
export function decideReplies(opts: {
  config: AutoReplyConfig;
  hours: WorkingHours;
  inboundIndex: number;
  text: string;
  now?: Date;
}): string[] {
  const { config, hours, inboundIndex, text } = opts;
  if (!config.enabled) return [];
  const kw = matchKeyword(config.keyword_rules ?? [], text);
  if (kw) return [kw.reply];
  const qs = (config.questions ?? []).filter((q) => q.trim());
  if (inboundIndex === 1) {
    if (!isWithinHours(hours, opts.now)) return [config.after_hours].filter(Boolean);
    return [config.greeting, qs[0]].filter((m): m is string => !!m && !!m.trim());
  }
  if (inboundIndex <= qs.length) return [qs[inboundIndex - 1] ?? ""].filter(Boolean);
  if (inboundIndex === qs.length + 1) return [config.handoff].filter(Boolean);
  return [];
}
