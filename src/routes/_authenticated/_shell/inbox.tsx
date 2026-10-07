import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Send, Bot, Gauge, PenLine, Activity, Clock3, RefreshCw, Radio } from "lucide-react";
import { scoreLead, draftReply } from "@/lib/ai.functions";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { sendMessage } from "@/lib/whatsapp.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, type LeadStatus, StatusBadge, displayPhone, timeAgo } from "@/components/ui-bits";
import { getIndustryExperience } from "@/lib/industry-experiences";

export const Route = createFileRoute("/_authenticated/_shell/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — RevenueDesk" },
      { name: "description", content: "Every WhatsApp lead and conversation in one place." },
      { property: "og:title", content: "Inbox — RevenueDesk" },
      { property: "og:description", content: "Every WhatsApp lead and conversation in one place." },
    ],
  }),
  component: InboxPage,
});

type Convo = {
  id: string;
  lead_id: string;
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
  leads: { id: string; name: string | null; phone: string; status: string; ai_score: number | null; ai_temperature: string | null; ai_summary: string | null } | null;
};

function InboxPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const experience = getIndustryExperience(ws?.profile.industry);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: convos = [], isLoading } = useQuery({
    queryKey: ["conversations", ws?.tenantId],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, lead_id, last_message_preview, last_message_at, unread_count, leads(id, name, phone, status, ai_score, ai_temperature, ai_summary)")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as Convo[];
    },
  });

  useEffect(() => {
    if (!ws) return;
    const ch = supabase
      .channel(`inbox-${ws.tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `tenant_id=eq.${ws.tenantId}` }, () =>
        qc.invalidateQueries({ queryKey: ["conversations"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `tenant_id=eq.${ws.tenantId}` }, () =>
        qc.invalidateQueries({ queryKey: ["conversations"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ws, qc]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return convos.filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (filter !== "all" && filter !== "unread" && c.leads?.status !== filter) return false;
      if (!s) return true;
      return (c.leads?.name ?? "").toLowerCase().includes(s) || (c.leads?.phone ?? "").includes(s.replace(/\D/g, "") || "~") || (c.last_message_preview ?? "").toLowerCase().includes(s);
    });
  }, [convos, q, filter]);

  const current = convos.find((c) => c.id === selected) ?? null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-dvh">
      <section className={`flex w-full flex-col border-r border-border md:w-[360px] md:shrink-0 ${current ? "hidden md:flex" : "flex"}`}>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{experience ? experience.label + " Conversations" : "Conversations"}</h1>
              <p className="mt-1 text-xs text-muted-foreground">{experience?.subheadline ?? "Every customer conversation in one place."}</p>
            </div>
            {experience && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">Industry mode</span>}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, message" className="h-10 rounded-xl pl-9" />
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {["all", "unread", ...LEAD_STATUSES].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs capitalize transition-colors ${filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium">{convos.length === 0 ? "No customer enquiries yet" : "Nothing matches"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {convos.length === 0 ? (experience ? "When a customer messages about " + experience.label.toLowerCase() + " work, the enquiry will appear here instantly." : "When a customer messages your WhatsApp, they'll appear here instantly.") : "Try a different search or filter."}
              </p>
            </div>
          ) : (
            <ul>
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className={`flex w-full gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-accent/60 ${selected === c.id ? "bg-accent" : ""}`}
                  >
                    <Avatar name={c.leads?.name} phone={c.leads?.phone ?? ""} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${c.unread_count ? "font-semibold" : "font-medium"}`}>
                          {c.leads?.name || displayPhone(c.leads?.phone ?? "")}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {c.leads?.ai_temperature && <TemperatureBadge temperature={c.leads.ai_temperature} />}
                          <span className="text-[11px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className={`truncate text-[13px] ${c.unread_count ? "text-foreground" : "text-muted-foreground"}`}>{c.last_message_preview}</span>
                        {c.unread_count > 0 ? (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{c.unread_count}</span>
                        ) : (
                          c.leads && <StatusBadge status={c.leads.status} />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={`min-w-0 flex-1 flex-col ${current ? "flex" : "hidden md:flex"}`}>
        {current ? (
          <Thread key={current.id} convo={current} tenantId={ws!.tenantId} onBack={() => setSelected(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
        )}
      </section>
    </div>
  );
}

function Avatar({ name, phone }: { name?: string | null | undefined; phone: string }) {
  const initials = name ? name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() : phone.slice(-2);
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</div>;
}

type Msg = { id: string; direction: string; body: string; is_auto: boolean; delivery_status: string; created_at: string };

function Thread({ convo, tenantId, onBack }: { convo: Convo; tenantId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const send = useServerFn(sendMessage);
  const score = useServerFn(scoreLead);
  const draft = useServerFn(draftReply);
  const [scoring, setScoring] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);\n  const [monitoring, setMonitoring] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lead = convo.leads!;

  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", convo.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("id, direction, body, is_auto, delivery_status, created_at")
        .eq("conversation_id", convo.id)
        .order("created_at")
        .limit(500);
      if (error) throw error;
      return data as Msg[];
    },
  });

  // Mark read on open and whenever new inbound arrives while open.
  useEffect(() => {
    if (convo.unread_count > 0) supabase.from("conversations").update({ unread_count: 0 }).eq("id", convo.id).then(() => {});
  }, [convo.id, convo.unread_count]);

  useEffect(() => {
    const ch = supabase
      .channel(`thread-${convo.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_messages", filter: `conversation_id=eq.${convo.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["messages", convo.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convo.id, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function submit() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await send({ data: { conversationId: convo.id, body } });
      setText("");
      if (r.status !== "sent") toast.error(r.error ?? "Message not delivered");
      qc.invalidateQueries({ queryKey: ["messages", convo.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function runScore() {
    setScoring(true);
    try {
      const r = await score({ data: { leadId: lead.id } });
      toast.success(`Scored ${r.score}/10 — ${r.temperature}`);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not score this lead");
    } finally { setScoring(false); }
  }

  async function runDraft() {
    setDrafting(true);
    try {
      const r = await draft({ data: { leadId: lead.id } });
      setText(r.reply);
      toast.success("Draft ready — check it, then send");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft a reply");
    } finally { setDrafting(false); }
  }

  async function monitorWhatsApp() {
    setMonitoring(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch("/api/whatsapp-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not start WhatsApp monitoring");
      toast.success("WhatsApp activity monitoring started");
      qc.invalidateQueries({ queryKey: ["whatsapp-presence", lead.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start WhatsApp monitoring");
    } finally {
      setMonitoring(false);
    }
  }

  const { data: presence, isLoading: presenceLoading, refetch: refetchPresence } = useQuery({
    queryKey: ["whatsapp-presence", lead.id],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`/api/whatsapp-presence?leadId=${encodeURIComponent(lead.id)}&days=30&timezone=Africa%2FJohannesburg`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to load WhatsApp activity");
      return result.report as {
        summary: {
          observedDays: number;
          presenceObservations: number;
          activeObservations: number;
          replyMessages: number;
          measuredReplyPairs: number;
          medianResponseMinutes: number | null;
          p90ResponseMinutes: number | null;
          confidence: "low" | "medium" | "high";
        };
        availability: Array<{ day: string; hourLabel: string; observedDays: number; repeatRate: number }>;
        replyHours: Array<{ day: string; hourLabel: string; replies: number }>;
        narrative: string;
        evidence: { firstObservationAt: string | null; lastObservationAt: string | null };
      };
    },
    enabled: true,
    staleTime: 60_000,
  });

  async function setStatus(status: string) {
    const { error } = await supabase.from("leads").update({ status: status as LeadStatus, updated_at: new Date().toISOString() }).eq("id", lead.id);
    if (error) { toast.error("Could not update status"); return; }
    await supabase.from("lead_events").insert({ tenant_id: tenantId, lead_id: lead.id, type: "status_changed", payload: { status } });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <Avatar name={lead.name} phone={lead.phone} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{lead.name || displayPhone(lead.phone)}</p>
          <p className="text-xs text-muted-foreground">{displayPhone(lead.phone)}</p>
        </div>
        {lead.ai_temperature && lead.ai_score != null && (
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="text-sm font-semibold">{lead.ai_score}/10</span>
            <TemperatureBadge temperature={lead.ai_temperature} />
          </span>
        )}
        <Button variant="outline" size="sm" onClick={runScore} disabled={scoring} className="h-9 rounded-xl">
          <Gauge className="mr-1.5 h-4 w-4" />{scoring ? "Scoring…" : lead.ai_score != null ? "Re-score" : "Score with AI"}
        </Button>
        <select
          value={lead.status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-input bg-card px-2.5 text-xs capitalize text-foreground"
          aria-label="Lead status"
        >
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </header>

      {lead.ai_summary && (
        <div className="border-b border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">AI: </span>{lead.ai_summary}
        </div>
      )}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Activity className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">WhatsApp activity fingerprint</p>
                {presence?.summary.confidence && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium capitalize text-secondary-foreground">
                    {presence.summary.confidence} confidence
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Observed behaviour from the connected WhatsApp account — not published business hours.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {presence && (
              <Button variant="ghost" size="sm" onClick={() => refetchPresence()} disabled={presenceLoading} className="h-8 rounded-lg text-xs">
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${presenceLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={monitorWhatsApp} disabled={monitoring} className="h-8 rounded-lg text-xs">
              <Radio className="mr-1.5 h-3.5 w-3.5" />{monitoring ? "Starting…" : presence ? "Monitor again" : "Start monitoring"}
            </Button>
          </div>
        </div>

        {presence ? (
          <>
            <p className="mt-3 max-w-4xl text-xs leading-5 text-foreground">{presence.narrative}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Observed days" value={String(presence.summary.observedDays)} />
              <Metric label="Active observations" value={String(presence.summary.activeObservations)} />
              <Metric label="Reply messages" value={String(presence.summary.replyMessages)} />
              <Metric label="Median reply" value={presence.summary.medianResponseMinutes == null ? "—" : formatMinutes(presence.summary.medianResponseMinutes)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ActivityList title="Recurring activity" icon={<Activity className="h-3.5 w-3.5" />} items={presence.availability.slice(0, 4).map((item) => `${item.day} ${item.hourLabel}`)} />
              <ActivityList title="Reply concentration" icon={<Clock3 className="h-3.5 w-3.5" />} items={presence.replyHours.slice(0, 4).map((item) => `${item.day} ${item.hourLabel} · ${item.replies}`)} />
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            No activity fingerprint has been collected for this lead yet. Start monitoring and let the evidence accumulate.
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.direction === "outbound" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-secondary-foreground"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 flex items-center gap-1 text-[10px] ${m.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {m.is_auto && <><Bot className="h-3 w-3" /> Auto ·</>}
                {new Date(m.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                {m.delivery_status === "failed" && <span className="font-semibold"> · Not sent</span>}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex">
          <Button variant="ghost" size="sm" onClick={runDraft} disabled={drafting} className="h-8 rounded-lg text-xs">
            <PenLine className="mr-1.5 h-3.5 w-3.5" />{drafting ? "Writing…" : "Draft reply with AI"}
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Type a reply"
            rows={1}
            className="max-h-32 min-h-11 resize-none rounded-xl"
          />
          <Button onClick={submit} disabled={sending || !text.trim()} size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ActivityList({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium">{icon}{title}</div>
      {items.length ? (
        <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Not enough repeated evidence yet.</p>
      )}
    </div>
  );
}
