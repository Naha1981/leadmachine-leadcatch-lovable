import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Send } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { normalizeWorkingHours } from "@/lib/autoreply";
import { getIndustryExperience } from "@/lib/industry-experiences";
import {
  cancelBooking, confirmBooking, ensureSlots, listBookings, listConversationMessages, listSimConversations,
  listSlots, slotLabel, startSimulatedEnquiry, type Booking,
} from "@/lib/bookings";
import { BookingCard } from "@/components/BookingCard";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/_shell/bookings")({
  head: () => ({ meta: [{ title: "Bookings — RevenueDesk" }, { name: "description", content: "Open times, confirmed bookings and a test enquiry." }] }),
  component: BookingsPage,
});

function BookingsPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const tenantId = ws?.tenantId ?? "";
  const hours = normalizeWorkingHours(ws?.profile.working_hours);
  const experience = getIndustryExperience(ws?.profile.industry);
  const service = experience?.services[0] ?? "Appointment";

  const slotsQ = useQuery({ queryKey: ["slots", tenantId], enabled: !!ws, queryFn: () => listSlots(tenantId) });
  const bookingsQ = useQuery({ queryKey: ["bookings", tenantId], enabled: !!ws, queryFn: () => listBookings(tenantId) });
  const simQ = useQuery({ queryKey: ["sim-convos", tenantId], enabled: !!ws, queryFn: () => listSimConversations(tenantId) });

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId && simQ.data?.length) setActiveId(simQ.data[0]!.id);
  }, [activeId, simQ.data]);
  const [text, setText] = useState(experience?.customerMessage ?? "Hi, I would like to book an appointment.");
  const [busy, setBusy] = useState(false);

  const activeConvo = (simQ.data ?? []).find((c) => c.id === activeId) ?? null;
  const msgsQ = useQuery({
    queryKey: ["sim-messages", activeId], enabled: !!activeId,
    queryFn: () => listConversationMessages(activeId!),
  });
  const bookingById = new Map((bookingsQ.data ?? []).map((b) => [b.id, b]));
  const confirmed = (msgsQ.data ?? []).some((m) => m.kind === "booking" && bookingById.get(m.booking_id ?? "")?.status === "confirmed");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["slots"] });
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["sim-convos"] });
    qc.invalidateQueries({ queryKey: ["sim-messages"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    qc.invalidateQueries({ queryKey: ["messages"] });
  };

  async function run<T>(fn: () => Promise<T>, fail: string): Promise<T | undefined> {
    setBusy(true);
    try { const r = await fn(); refresh(); return r; }
    catch (e) { toast.error(e instanceof Error ? e.message : fail); return undefined; }
    finally { setBusy(false); }
  }

  async function sendEnquiry() {
    if (!text.trim()) return;
    const r = await run(() => startSimulatedEnquiry(tenantId, hours, text.trim(), service), "Could not start the test enquiry");
    if (r) setActiveId(r.conversationId);
  }
  async function confirm() {
    if (!activeConvo) return;
    const b = await run(() => confirmBooking({ tenantId, conversationId: activeConvo.id, leadId: activeConvo.lead_id, service, simulated: true }), "Could not confirm the booking");
    if (b) toast.success("Booking confirmed");
  }

  const openSlots = (slotsQ.data ?? []).filter((s) => s.status === "open");

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      <PageHeader title="Bookings" subtitle="Open times your assistant can offer, and every confirmed booking." />

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open times</h2>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => ensureSlots(tenantId, hours), "Could not set up times")}>
              Set up times from my working hours
            </Button>
          </div>
          <ul data-testid="open-slots" className="mt-3 grid max-h-60 grid-cols-2 gap-2 overflow-y-auto text-xs">
            {openSlots.length === 0 && <li className="col-span-2 text-muted-foreground">No open times yet. Set them up from your working hours.</li>}
            {openSlots.slice(0, 24).map((s) => (<li key={s.id} className="rounded-lg bg-muted px-2.5 py-1.5">{slotLabel(s.starts_at)}</li>))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Confirmed bookings</h2>
          <ul data-testid="owner-bookings" className="mt-3 space-y-2">
            {(bookingsQ.data ?? []).filter((b) => b.status === "confirmed").length === 0 && <li className="text-sm text-muted-foreground">No bookings yet.</li>}
            {(bookingsQ.data ?? []).filter((b) => b.status === "confirmed").map((b: Booking) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <span>
                  <span className="flex items-center gap-1.5 font-medium"><CalendarDays className="h-4 w-4 text-primary" />{slotLabel(b.starts_at)}</span>
                  <span className="text-xs text-muted-foreground">{b.customer_name}{b.service ? ` · ${b.service}` : ""}{b.simulated ? " · test" : ""}</span>
                </span>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => cancelBooking(tenantId, b), "Could not cancel")}>Cancel</Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Test a customer enquiry</h2>
        <p className="mt-1 text-xs text-muted-foreground">Play the Potential Customer. No phone needed. The booking shows in the chat below, in your conversations and in your list above.</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <div data-testid="customer-chat" className="flex h-80 flex-col gap-2 overflow-y-auto rounded-2xl bg-muted/50 p-3">
              {!activeConvo && <p className="m-auto text-xs text-muted-foreground">Send an enquiry to start.</p>}
              {(msgsQ.data ?? []).map((m) => (
                <div key={m.id} className={m.direction === "inbound" ? "flex justify-end" : "flex justify-start"}>
                  {m.kind === "booking" ? (
                    <BookingCard startsAt={bookingById.get(m.booking_id ?? "")?.starts_at} service={bookingById.get(m.booking_id ?? "")?.service} />
                  ) : (
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direction === "inbound" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>{m.body}</div>
                  )}
                </div>
              ))}
            </div>
            {activeConvo && !confirmed && (
              <Button data-testid="confirm-slot" className="mt-3 w-full rounded-xl" disabled={busy} onClick={confirm}>Confirm slot</Button>
            )}
          </div>
          <div className="space-y-3">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-xl" aria-label="Potential Customer message" />
            <Button data-testid="send-enquiry" className="rounded-xl" disabled={busy} onClick={sendEnquiry}><Send className="mr-2 h-4 w-4" />Send as Potential Customer</Button>
            {(simQ.data ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 text-xs">
                {(simQ.data ?? []).slice(0, 5).map((c, i) => (
                  <button key={c.id} onClick={() => setActiveId(c.id)} className={`rounded-lg px-2.5 py-1 ${activeId === c.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Test chat {i + 1}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
