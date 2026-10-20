import { supabase } from "@/integrations/supabase/client";
import { getIndustryExperience } from "@/lib/industry-experiences";
import { isE2E, listBookings, listConversationMessages, listSimConversations } from "@/lib/bookings";

export type PostSource = "radar" | "enquiries" | "bookings" | "trend";
export type WeeklyPost = {
  id: string; tenant_id: string; week_start: string; post_day: string; topic: string; source: PostSource;
  source_note: string | null; copy: string; status: "draft" | "approved" | "rejected"; approved_at: string | null;
  channel?: string | null; channel_post_id?: string | null; scheduled_for?: string | null;
  posted_url?: string | null; publish_state?: PublishState | null; post_error?: string | null;
};
export type Signals = {
  radar: { title: string; suburb?: string | undefined }[];
  questions: string[];
  bookingsCount: number;
  topService: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const KEY = "revenuedesk-e2e-weekly";
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function weekStart(d = new Date()): string {
  const x = new Date(d); const diff = (x.getDay() + 6) % 7; x.setDate(x.getDate() - diff);
  return x.toISOString().slice(0, 10);
}

export async function gatherSignals(tenantId: string): Promise<Signals> {
  const out: Signals = { radar: [], questions: [], bookingsCount: 0, topService: null };
  const bookings = (await listBookings(tenantId).catch(() => [])).filter((b) => b.status === "confirmed");
  out.bookingsCount = bookings.length;
  const counts = new Map<string, number>();
  for (const b of bookings) if (b.service) counts.set(b.service, (counts.get(b.service) ?? 0) + 1);
  out.topService = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (isE2E()) {
    for (const c of await listSimConversations(tenantId)) {
      for (const m of await listConversationMessages(c.id)) if (m.direction === "inbound") out.questions.push(m.body);
    }
    out.radar.push({ title: "Looking for a reliable provider nearby, need someone this week", suburb: "Sandton" });
  } else {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: msgs } = await db.from("conversation_messages").select("body").eq("tenant_id", tenantId).eq("direction", "inbound").gte("created_at", since).limit(300);
    out.questions = ((msgs ?? []) as { body: string }[]).map((m) => m.body).filter((t) => t.includes("?"));
    const { data: sig } = await db.from("demand_signals").select("topic, frequency").eq("tenant_id", tenantId).order("frequency", { ascending: false }).limit(5);
    out.radar = ((sig ?? []) as { topic: string }[]).map((s) => ({ title: s.topic }));
  }
  return out;
}

/** Builds five draft posts for the week from the business's own signals plus industry topics. */
export function buildPlan(opts: { tenantId: string; industry: string; businessName: string; suburb: string; signals: Signals; week: string }): Omit<WeeklyPost, "id">[] {
  const exp = getIndustryExperience(opts.industry);
  const label = exp?.label ?? "service";
  const area = opts.suburb || "your area";
  const biz = opts.businessName || "us";
  const services = exp?.services ?? ["our services"];
  const plans: { topic: string; source: PostSource; note: string; copy: string }[] = [];

  const q = opts.signals.questions[0];
  plans.push({
    topic: "Answering a question customers keep asking", source: "enquiries",
    note: q ? `Customers asked: "${q.slice(0, 90)}"` : `Common ${label.toLowerCase()} questions`,
    copy: q
      ? `Customers often ask: "${q.slice(0, 120)}"\n\nShort answer: send us a message and we reply within minutes with a clear answer and the next step.\n\n${biz}, serving ${area}.`
      : `The question we hear most: "${exp?.customerMessage ?? "Can you help me this week?"}"\n\nYes. Message us and you get a reply fast, plus the next available time.\n\n${biz}, serving ${area}.`,
  });
  const r = opts.signals.radar[0];
  plans.push({
    topic: "Local demand this week", source: "radar",
    note: r ? `Demand noticed nearby: "${r.title.slice(0, 90)}"${r.suburb ? ` (${r.suburb})` : ""}` : `Demand for ${label.toLowerCase()} in ${area}`,
    copy: `People in ${r?.suburb ?? area} are looking for ${services[0]!.toLowerCase()} right now.\n\nWe have times open this week. Message us to book yours before they fill up.\n\n${biz}`,
  });
  plans.push({
    topic: opts.signals.topService ? `Featured: ${opts.signals.topService}` : `Featured: ${services[1] ?? services[0]}`, source: "bookings",
    note: opts.signals.bookingsCount ? `${opts.signals.bookingsCount} booking(s) so far, most for ${opts.signals.topService ?? "your top service"}` : "No bookings yet, so this features a core service",
    copy: `${opts.signals.topService ?? services[1] ?? services[0]}: one of our most booked services.\n\nWhat you get: a quick reply, a confirmed time and no chasing.\n\nBook by sending us a message. ${biz}, ${area}.`,
  });
  plans.push({
    topic: "Seasonal tip", source: "trend",
    note: `Seasonal topic for ${label.toLowerCase()}, ${new Date().toLocaleString("en-ZA", { month: "long" })}`,
    copy: `A quick tip from ${biz}: ${exp?.problem ?? "small problems get expensive when they wait."}\n\nIf you are unsure, send us a message and we will tell you what to check first.`,
  });
  plans.push({
    topic: "Why customers choose us", source: "trend",
    note: "Trust post: fast replies and clear next steps",
    copy: `${exp?.outcome ?? "Every enquiry gets a fast reply."}\n\nThat is how ${biz} works. Message us today and see how quickly we reply.`,
  });
  return plans.map((p, i) => ({ tenant_id: opts.tenantId, week_start: opts.week, post_day: DAYS[i]!, topic: p.topic, source: p.source, source_note: p.note, copy: p.copy, status: "draft" as const, approved_at: null }));
}

function loadLocal(): WeeklyPost[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as WeeklyPost[]; } catch { return []; } }
function saveLocal(p: WeeklyPost[]) { localStorage.setItem(KEY, JSON.stringify(p)); }

export async function listPosts(tenantId: string, week: string): Promise<WeeklyPost[]> {
  if (isE2E()) return loadLocal().filter((p) => p.week_start === week);
  const { data, error } = await db.from("weekly_content_posts").select("*").eq("tenant_id", tenantId).eq("week_start", week).order("created_at");
  if (error) throw error;
  return data as WeeklyPost[];
}

export async function generatePlan(opts: Parameters<typeof buildPlan>[0]): Promise<void> {
  const rows = buildPlan(opts);
  if (isE2E()) { const keep = loadLocal().filter((p) => p.week_start !== opts.week); saveLocal([...keep, ...rows.map((r) => ({ ...r, id: uid() }))]); return; }
  await db.from("weekly_content_posts").delete().eq("tenant_id", opts.tenantId).eq("week_start", opts.week).eq("status", "draft");
  const { error } = await db.from("weekly_content_posts").insert(rows);
  if (error) throw error;
}

export async function updatePost(tenantId: string, id: string, patch: Partial<Pick<WeeklyPost, "copy" | "status">>): Promise<void> {
  const full = { ...patch, ...(patch.status === "approved" ? { approved_at: new Date().toISOString() } : patch.status ? { approved_at: null } : {}) };
  if (isE2E()) { saveLocal(loadLocal().map((p) => (p.id === id ? { ...p, ...full } : p))); return; }
  const { error } = await db.from("weekly_content_posts").update(full).eq("id", id).eq("tenant_id", tenantId);
  if (error) throw error;
}

// ---- Social posting (approve -> schedule -> auto-post) ---------------------
export type ChannelAccount = { channel: string; handle: string; max_caption_chars: number };
export type PublishState = "scheduled" | "published" | "failed";

/** Bluesky captions cap at 300 chars; trim the post copy at a word boundary. */
export function captionForChannel(copy: string, max = 300): string {
  const flat = copy.trim();
  if ([...flat].length <= max) return flat;
  const cut = [...flat].slice(0, max - 1).join("");
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n")))}…`;
}

/** Map a plan day name to this week's date at 09:00 local; past days post now. */
export function scheduleFor(postDay: string, week: string): string | null {
  const idx = DAYS.indexOf(postDay);
  if (idx < 0) return null;
  const d = new Date(`${week}T09:00:00`);
  d.setDate(d.getDate() + idx);
  return d.getTime() > Date.now() + 60_000 ? d.toISOString() : null; // null = publish now
}

async function bridge<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in again to continue");
  const res = await fetch(`${window.location.origin}/bridge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Posting service unreachable");
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export async function listChannelAccounts(): Promise<ChannelAccount[]> {
  if (isE2E()) return [{ channel: "bluesky", handle: "demo.bsky.social", max_caption_chars: 300 }];
  const r = await bridge<{ items: ChannelAccount[] }>({ action: "accounts" });
  return r.items ?? [];
}

export async function connectChannel(channel: string, handle: string, appPassword: string): Promise<void> {
  await bridge({ action: "connect", channel, handle, app_password: appPassword });
}

type ApiPost = { id: string; status: string; scheduled_at: string | null; published_at: string | null; external_url: string | null; error: string | null };

/** Approve: create the channel post and schedule it (or post now when its day has passed). */
export async function sendToChannel(post: WeeklyPost, week: string): Promise<{ id: string; scheduled_for: string | null; state: PublishState; url: string | null; error: string | null }> {
  const when = scheduleFor(post.post_day, week);
  if (isE2E()) return { id: uid(), scheduled_for: when ?? new Date().toISOString(), state: "scheduled", url: null, error: null };
  const created = await bridge<ApiPost>({ action: "create", channel: "bluesky", caption: captionForChannel(post.copy), title: post.topic, idempotency_key: `weekly-${post.id}` });
  const sched = await bridge<ApiPost>({ action: "schedule", id: created.id, ...(when ? { scheduled_at: when } : {}) });
  return {
    id: created.id,
    scheduled_for: sched.scheduled_at ?? sched.published_at,
    state: (sched.status as PublishState) ?? "scheduled",
    url: sched.external_url,
    error: sched.error,
  };
}

export async function cancelChannelPost(channelPostId: string): Promise<void> {
  if (isE2E()) return;
  await bridge({ action: "cancel", id: channelPostId });
}

/** Refresh publish_state/posted_url for rows already sent to the channel. */
export async function syncChannelStatus(tenantId: string, posts: WeeklyPost[]): Promise<void> {
  const tracked = posts.filter((p) => p.channel_post_id && p.publish_state !== "published");
  if (tracked.length === 0 || isE2E()) return;
  const r = await bridge<{ items: ApiPost[] }>({ action: "list" });
  const byId = new Map((r.items ?? []).map((p) => [p.id, p]));
  for (const p of tracked) {
    const a = byId.get(p.channel_post_id!);
    if (!a) continue;
    const patch = {
      publish_state: a.status as PublishState,
      posted_url: a.external_url,
      scheduled_for: a.scheduled_at,
      post_error: a.error,
    };
    await db.from("weekly_content_posts").update(patch).eq("id", p.id).eq("tenant_id", tenantId);
  }
}

export async function markSentToChannel(tenantId: string, id: string, r: { id: string; scheduled_for: string | null; state: PublishState; url: string | null; error: string | null }): Promise<void> {
  const patch: Partial<WeeklyPost> = { status: "approved", approved_at: new Date().toISOString(), channel: "bluesky", channel_post_id: r.id, scheduled_for: r.scheduled_for, publish_state: r.state, posted_url: r.url, post_error: r.error };
  if (isE2E()) { saveLocal(loadLocal().map((p) => (p.id === id ? { ...p, ...patch } : p))); return; }
  const { error } = await db.from("weekly_content_posts").update(patch).eq("id", id).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function clearChannelState(tenantId: string, id: string): Promise<void> {
  const patch: Partial<WeeklyPost> = { channel: null, channel_post_id: null, scheduled_for: null, publish_state: null, posted_url: null, post_error: null, status: "draft", approved_at: null };
  if (isE2E()) { saveLocal(loadLocal().map((p) => (p.id === id ? { ...p, ...patch } : p))); return; }
  const { error } = await db.from("weekly_content_posts").update(patch).eq("id", id).eq("tenant_id", tenantId);
  if (error) throw error;
}
