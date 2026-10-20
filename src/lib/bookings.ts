import { supabase } from "@/integrations/supabase/client";
import type { WorkingHours } from "@/lib/autoreply";

export type Slot = { id: string; tenant_id: string; starts_at: string; ends_at: string; status: "open" | "booked" };
export type Booking = {
  id: string; tenant_id: string; slot_id: string | null; lead_id: string | null; conversation_id: string | null;
  customer_name: string; customer_phone: string | null; service: string | null;
  starts_at: string; ends_at: string; status: "confirmed" | "cancelled"; simulated: boolean; created_at: string;
};
export type ChatMessage = {
  id: string; conversation_id: string; direction: "inbound" | "outbound"; body: string;
  kind: "text" | "booking"; booking_id: string | null; created_at: string;
};
export type SimConversation = { id: string; lead_id: string; customer_name: string; created_at: string };

export const isE2E = () => import.meta.env["VITE_E2E_MODE"] === "true";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/* ---------- local store used only in E2E/demo mode (no database) ---------- */
type Store = { slots: Slot[]; bookings: Booking[]; messages: ChatMessage[]; convos: SimConversation[] };
const KEY = "revenuedesk-e2e-bookings";
function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "") as Store; } catch { return { slots: [], bookings: [], messages: [], convos: [] }; }
}
function save(s: Store) { localStorage.setItem(KEY, JSON.stringify(s)); }
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function slotLabel(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Builds hourly slots for the next 7 days inside the business's working hours. */
export function buildSlots(tenantId: string, hours: WorkingHours, from = new Date()): Omit<Slot, "id">[] {
  const out: Omit<Slot, "id">[] = [];
  const [sh] = (hours.start || "08:00").split(":").map(Number);
  const [eh] = (hours.end || "17:00").split(":").map(Number);
  for (let d = 0; d < 7; d++) {
    const day = new Date(from);
    day.setDate(day.getDate() + d);
    if (!hours.days.includes(day.getDay())) continue;
    for (let h = sh!; h < eh!; h++) {
      const start = new Date(day); start.setHours(h, 0, 0, 0);
      if (start.getTime() <= from.getTime()) continue;
      const end = new Date(start.getTime() + 3_600_000);
      out.push({ tenant_id: tenantId, starts_at: start.toISOString(), ends_at: end.toISOString(), status: "open" });
    }
  }
  return out;
}

/** Picks the slot to offer: the first future open slot matching the customer's requested day and part of day. */
export function pickOfferSlot(slots: Slot[], customerText: string, now = new Date()): Slot | null {
  const open = slots.filter((s) => s.status === "open" && new Date(s.starts_at).getTime() > now.getTime());
  if (!open.length) return null;
  const t = customerText.toLowerCase();
  let wanted = open;
  let dayOffset: number | null = null;
  if (/\btomorrow\b/.test(t)) dayOffset = 1;
  else if (/\btoday\b/.test(t)) dayOffset = 0;
  else {
    const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < 7; i++) {
      if (new RegExp(`\\b${names[i]}\\b`).test(t)) {
        const diff = (i - now.getDay() + 7) % 7;
        dayOffset = diff === 0 ? 7 : diff;
        break;
      }
    }
  }
  if (dayOffset !== null) {
    const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() + dayOffset); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const inDay = wanted.filter((s) => { const st = new Date(s.starts_at); return st >= dayStart && st < dayEnd; });
    if (inDay.length) wanted = inDay;
  }
  let range: [number, number] | null = null;
  if (/\bmorning\b/.test(t)) range = [6, 12];
  else if (/\bafternoon\b/.test(t)) range = [12, 17];
  else if (/\bevening\b/.test(t)) range = [17, 22];
  if (range) {
    const [lo, hi] = range;
    const inRange = wanted.filter((s) => { const h = new Date(s.starts_at).getHours(); return h >= lo && h < hi; });
    if (inRange.length) wanted = inRange;
  }
  return wanted[0] ?? null;
}

export async function listSlots(tenantId: string): Promise<Slot[]> {
  if (isE2E()) return load().slots.filter((s) => new Date(s.ends_at) > new Date()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const { data, error } = await db.from("availability_slots").select("*").eq("tenant_id", tenantId)
    .gte("ends_at", new Date().toISOString()).order("starts_at").limit(200);
  if (error) throw error;
  return data as Slot[];
}

export async function ensureSlots(tenantId: string, hours: WorkingHours): Promise<Slot[]> {
  const existing = await listSlots(tenantId);
  if (existing.some((s) => s.status === "open")) return existing;
  const fresh = buildSlots(tenantId, hours);
  if (isE2E()) {
    const s = load();
    const have = new Set(s.slots.map((x) => x.starts_at));
    for (const f of fresh) if (!have.has(f.starts_at)) s.slots.push({ ...f, id: uid() });
    save(s);
  } else if (fresh.length) {
    const { error } = await db.from("availability_slots").upsert(fresh, { onConflict: "tenant_id,starts_at", ignoreDuplicates: true });
    if (error) throw error;
  }
  return listSlots(tenantId);
}

export async function listBookings(tenantId: string): Promise<Booking[]> {
  if (isE2E()) return load().bookings.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const { data, error } = await db.from("bookings").select("*").eq("tenant_id", tenantId).order("starts_at").limit(200);
  if (error) throw error;
  return data as Booking[];
}

export async function cancelBooking(tenantId: string, booking: Booking) {
  if (isE2E()) {
    const s = load();
    s.bookings = s.bookings.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" } : b));
    s.slots = s.slots.map((x) => (x.id === booking.slot_id ? { ...x, status: "open" } : x));
    save(s); return;
  }
  await db.from("bookings").update({ status: "cancelled" }).eq("id", booking.id).eq("tenant_id", tenantId);
  if (booking.slot_id) await db.from("availability_slots").update({ status: "open" }).eq("id", booking.slot_id).eq("tenant_id", tenantId);
}

export async function listConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  if (isE2E()) return load().messages.filter((m) => m.conversation_id === conversationId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { data, error } = await db.from("conversation_messages")
    .select("id, conversation_id, direction, body, kind, booking_id, created_at").eq("conversation_id", conversationId).order("created_at").limit(500);
  if (error) throw error;
  return data as ChatMessage[];
}

export async function listSimConversations(tenantId: string) {
  if (isE2E()) return load().convos;
  const { data, error } = await db.from("conversations").select("id, lead_id, created_at, leads(name, source)")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data as { id: string; lead_id: string; created_at: string; leads: { name: string | null; source: string } | null }[])
    .filter((c) => c.leads?.source === "simulated")
    .map((c) => ({ id: c.id, lead_id: c.lead_id, customer_name: c.leads?.name ?? "Potential Customer", created_at: c.created_at }));
}

async function addMessage(tenantId: string, m: { conversation_id: string; lead_id: string; direction: "inbound" | "outbound"; body: string; kind?: "text" | "booking"; booking_id?: string | null }) {
  const row = { kind: "text", booking_id: null, ...m };
  if (isE2E()) {
    const s = load();
    s.messages.push({ id: uid(), conversation_id: m.conversation_id, direction: m.direction, body: m.body, kind: row.kind as "text" | "booking", booking_id: row.booking_id ?? null, created_at: new Date().toISOString() });
    save(s); return;
  }
  const { error } = await db.from("conversation_messages").insert({ tenant_id: tenantId, is_auto: m.direction === "outbound", sender: m.direction === "outbound" ? "auto" : "customer", delivery_status: "simulated", ...row });
  if (error) throw error;
  await db.from("conversations").update({ last_message_preview: m.body.slice(0, 120), last_message_at: new Date().toISOString() }).eq("id", m.conversation_id);
}

/** Simulated enquiry: a "Potential Customer" messages in; the assistant offers the next open slot. */
export async function startSimulatedEnquiry(tenantId: string, hours: WorkingHours, text: string, service: string): Promise<{ conversationId: string; leadId: string }> {
  const slots = await ensureSlots(tenantId, hours);
  const next = pickOfferSlot(slots, text);
  let conversationId: string; let leadId: string;
  if (isE2E()) {
    const s = load(); conversationId = uid(); leadId = uid();
    s.convos.unshift({ id: conversationId, lead_id: leadId, customer_name: "Potential Customer", created_at: new Date().toISOString() });
    save(s);
  } else {
    const existing = await db.from("leads").select("id").eq("tenant_id", tenantId).eq("phone", "27000000000").eq("source", "simulated").maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      leadId = existing.data.id;
    } else {
      const lead = await db.from("leads").insert({ tenant_id: tenantId, name: "Potential Customer", phone: "27000000000", source: "simulated", service }).select("id").single();
      if (lead.error) throw lead.error;
      leadId = lead.data.id;
    }
    // conversations.lead_id is unique: a returning Potential Customer continues the same test chat.
    const existingConv = await db.from("conversations").select("id").eq("tenant_id", tenantId).eq("lead_id", leadId).maybeSingle();
    if (existingConv.error) throw existingConv.error;
    if (existingConv.data) {
      conversationId = existingConv.data.id;
    } else {
      const conv = await db.from("conversations").insert({ tenant_id: tenantId, lead_id: leadId, last_message_preview: text.slice(0, 120) }).select("id").single();
      if (conv.error) throw conv.error;
      conversationId = conv.data.id;
    }
  }
  await addMessage(tenantId, { conversation_id: conversationId, lead_id: leadId, direction: "inbound", body: text });
  const reply = next
    ? `Thanks for getting in touch. I can book you in for ${slotLabel(next.starts_at)}. Tap Confirm slot to lock it in, or ask for another time.`
    : "Thanks for getting in touch. There are no open times right now. The owner will contact you shortly.";
  await addMessage(tenantId, { conversation_id: conversationId, lead_id: leadId, direction: "outbound", body: reply });
  return { conversationId, leadId };
}

/** Customer confirms: slot is claimed, booking saved, and a booking card lands in the conversation. */
export async function confirmBooking(opts: { tenantId: string; conversationId: string; leadId: string; service: string; simulated: boolean }): Promise<Booking> {
  const msgs = await listConversationMessages(opts.conversationId);
  const lastInbound = [...msgs].reverse().find((m) => m.direction === "inbound" && m.kind === "text");
  const slots = await listSlots(opts.tenantId);
  const slot = pickOfferSlot(slots, lastInbound?.body ?? "");
  if (!slot) throw new Error("No open times left");
  let booking: Booking;
  if (isE2E()) {
    const s = load();
    const target = s.slots.find((x) => x.id === slot.id)!;
    if (target.status !== "open") throw new Error("That time was just taken");
    target.status = "booked";
    booking = { id: uid(), tenant_id: opts.tenantId, slot_id: slot.id, lead_id: opts.leadId, conversation_id: opts.conversationId, customer_name: "Potential Customer", customer_phone: null, service: opts.service, starts_at: slot.starts_at, ends_at: slot.ends_at, status: "confirmed", simulated: opts.simulated, created_at: new Date().toISOString() };
    s.bookings.push(booking); save(s);
  } else {
    const claim = await db.from("availability_slots").update({ status: "booked" }).eq("id", slot.id).eq("tenant_id", opts.tenantId).eq("status", "open").select("id");
    if (claim.error) throw claim.error;
    if (!claim.data?.length) throw new Error("That time was just taken. Try again.");
    const ins = await db.from("bookings").insert({ tenant_id: opts.tenantId, slot_id: slot.id, lead_id: opts.leadId, conversation_id: opts.conversationId, customer_name: "Potential Customer", service: opts.service, starts_at: slot.starts_at, ends_at: slot.ends_at, simulated: opts.simulated }).select("*").single();
    if (ins.error) throw ins.error;
    booking = ins.data as Booking;
  }
  await addMessage(tenantId(opts), { conversation_id: opts.conversationId, lead_id: opts.leadId, direction: "outbound", body: `Booking confirmed: ${slotLabel(booking.starts_at)}`, kind: "booking", booking_id: booking.id });
  // Best-effort: email the owner about the new booking. Never blocks the confirm.
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) await fetch(`${window.location.origin}/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "booking-email", service: opts.service, starts_at: booking.starts_at, customer_name: booking.customer_name }),
    });
  } catch { /* notification is best-effort */ }
  return booking;
}
const tenantId = (o: { tenantId: string }) => o.tenantId;
