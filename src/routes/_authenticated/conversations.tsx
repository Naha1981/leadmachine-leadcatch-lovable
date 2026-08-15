import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusPill } from "@/components/app/primitives";
import { conversationsQuery, messagesQuery } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { initialsOf, relativeTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — 2ndLife Revenue OS" },
      { name: "description", content: "Live WhatsApp conversations handled by the Conversation Engine." },
      { property: "og:title", content: "Conversations — 2ndLife Revenue OS" },
      { property: "og:description", content: "AI-assisted WhatsApp conversations with human handover." },
    ],
  }),
  component: ConversationsPage,
});

const bodySchema = z.string().trim().min(1).max(1000);

function ConversationsPage() {
  const queryClient = useQueryClient();
  const conversations = useQuery(conversationsQuery());
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const active = (conversations.data ?? []).find((c) => c.id === activeId);
  const messages = useQuery(messagesQuery(activeId));
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!activeId && (conversations.data ?? []).length > 0) {
      setActiveId(conversations.data![0]!.id);
    }
  }, [conversations.data, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`messages-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!active) throw new Error("Select a conversation first");
      const { error } = await supabase.from("messages").insert({
        tenant_id: active.tenant_id,
        conversation_id: active.id,
        direction: "outbound",
        sender: "agent",
        body,
      });
      if (error) throw new Error(error.message);
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString(), unread_count: 0 })
        .eq("id", active.id);
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader title="Conversations" subtitle="WhatsApp-first, AI-assisted, human-supervised" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="p-0">
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            {conversations.isLoading ? (
              <div className="p-4">
                <LoadingRows rows={5} />
              </div>
            ) : (conversations.data ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState title="No conversations" description="They appear once a campaign goes out." />
              </div>
            ) : (
              (conversations.data ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border p-4 text-left transition-colors hover:bg-muted/40",
                    c.id === activeId && "bg-muted/60",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {initialsOf(c.contacts?.full_name ?? "Unknown")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {c.contacts?.full_name ?? "Unknown contact"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.intent ?? titleCase(c.status)} · {relativeTime(c.last_message_at)}
                    </span>
                  </span>
                  {c.unread_count > 0 ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                      {c.unread_count}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </Panel>

        <Panel className="flex min-h-[520px] flex-col">
          {!active ? (
            <EmptyState title="Select a conversation" description="Pick a thread from the list." />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-bold">{active.contacts?.full_name ?? "Unknown contact"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {active.contacts?.phone ?? "—"} · {titleCase(active.channel)}
                  </p>
                </div>
                <StatusPill tone={active.status === "closed" ? "success" : "info"}>
                  {titleCase(active.status)}
                </StatusPill>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {messages.isLoading ? (
                  <LoadingRows rows={4} />
                ) : (
                  (messages.data ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                          m.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-[10px] opacity-70">{relativeTime(m.created_at)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                className="flex items-center gap-2 border-t border-border pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const parsed = bodySchema.safeParse(draft);
                  if (!parsed.success) {
                    toast.error("Type a message first (max 1000 characters)");
                    return;
                  }
                  sendMessage.mutate(parsed.data);
                }}
              >
                <Input
                  value={draft}
                  maxLength={1000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply on WhatsApp…"
                />
                <Button type="submit" disabled={sendMessage.isPending}>
                  <Send className="h-4 w-4" /> Send
                </Button>
              </form>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}