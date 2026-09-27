import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Search, Send, Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { sendMessage } from "@/lib/whatsapp.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES, StatusBadge, displayPhone, timeAgo } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/_shell/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — LeadCatch SA" },
      { name: "description", content: "Every WhatsApp lead and conversation in one place." },
      { property: "og:title", content: "Inbox — LeadCatch SA" },
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
  leads: { id: string; name: string | null; phone: string; status: string } | null;
};

function InboxPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: convos = [], isLoading } = useQuery({
    queryKey: ["conversations", ws?.tenantId],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, lead_id, last_message_preview, last_message_at, unread_count, leads(id, name, phone, status)")
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
          <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
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
              <p className="font-medium">{convos.length === 0 ? "No leads yet" : "Nothing matches"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {convos.length === 0 ? "When a customer messages your WhatsApp, they'll appear here instantly." : "Try a different search or filter."}
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
                        <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>
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
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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

  async function setStatus(status: string) {
    const { error } = await supabase.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", lead.id);
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
        <select
          value={lead.status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-input bg-card px-2.5 text-xs capitalize text-foreground"
          aria-label="Lead status"
        >
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </header>

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
