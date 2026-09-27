import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, timeAgo } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LeadCatch SA" },
      { name: "description", content: "Today's leads, unanswered enquiries and WhatsApp status at a glance." },
      { property: "og:title", content: "Dashboard — LeadCatch SA" },
      { property: "og:description", content: "Today's leads at a glance." },
    ],
  }),
  component: Dashboard,
});

const EVENT_LABEL: Record<string, string> = {
  lead_created: "New lead",
  message_received: "Message received",
  auto_reply_sent: "Auto-reply sent",
  reply_sent: "You replied",
  status_changed: "Status changed",
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Dashboard() {
  const { data: ws } = useWorkspace();
  const tenantId = ws?.tenantId;

  const { data } = useQuery({
    queryKey: ["dashboard", tenantId],
    enabled: !!tenantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const today = startOfToday();
      const [newLeads, unanswered, events, msgs] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("conversations").select("id", { count: "exact", head: true }).gt("unread_count", 0),
        supabase.from("lead_events").select("id, type, created_at, leads(name, phone)").order("created_at", { ascending: false }).limit(8),
        supabase.from("conversation_messages").select("conversation_id, direction, created_at").gte("created_at", today).order("created_at").limit(1000),
      ]);
      // Avg response time: first outbound after each inbound, per conversation, today.
      const pending = new Map<string, number>();
      const diffs: number[] = [];
      for (const m of msgs.data ?? []) {
        const t = new Date(m.created_at).getTime();
        if (m.direction === "inbound") { if (!pending.has(m.conversation_id)) pending.set(m.conversation_id, t); }
        else if (pending.has(m.conversation_id)) { diffs.push(t - pending.get(m.conversation_id)!); pending.delete(m.conversation_id); }
      }
      const avg = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length / 1000 : null;
      return { newLeads: newLeads.count ?? 0, unanswered: unanswered.count ?? 0, events: events.data ?? [], avg };
    },
  });

  const connected = ws?.profile.whatsapp_status === "connected";
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const avgLabel = data?.avg == null ? "—" : data.avg < 60 ? `${Math.round(data.avg)}s` : `${Math.round(data.avg / 60)}m`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader title={hello} subtitle={ws?.profile.business_name || undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="New leads today" value={data?.newLeads ?? "–"} />
        <Metric label="Need attention" value={data?.unanswered ?? "–"} highlight={!!data?.unanswered} />
        <Metric label="Avg response" value={avgLabel} />
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">WhatsApp</p>
          <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${connected ? "text-primary" : "text-foreground"}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`} />
            {connected ? "Connected" : "Offline"}
          </p>
          {!connected && <Link to="/settings" className="mt-1 inline-block text-xs text-muted-foreground underline-offset-4 hover:underline">Connect now</Link>}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="h-11 rounded-xl font-semibold"><Link to="/inbox">View Inbox <ArrowRight className="h-4 w-4" /></Link></Button>
        <Button asChild variant="secondary" className="h-11 rounded-xl"><Link to="/auto-reply">Edit Auto-Reply</Link></Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Today's activity</h2>
        <Card className="p-0">
          {data && data.events.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No activity yet. New WhatsApp enquiries will show up here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.events ?? []).map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</span>
                    <span className="text-muted-foreground"> · {e.leads?.name || `+${e.leads?.phone ?? ""}`}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}
