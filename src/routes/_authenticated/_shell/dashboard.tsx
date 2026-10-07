import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, Inbox, Radio, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, timeAgo } from "@/components/ui-bits";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { MarketIntelligencePanel } from "@/components/MarketIntelligencePanel";
import { getIndustryExperience } from "@/lib/industry-experiences";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({
    meta: [
      { title: "Revenue Desk — RevenueDesk" },
      { name: "description", content: "See what needs attention, where enquiries are leaking and what RevenueDesk is handling." },
    ],
  }),
  component: Dashboard,
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function Dashboard() {
  const { data: ws } = useWorkspace();
  const tenantId = ws?.tenantId;
  const experience = getIndustryExperience(ws?.profile.industry);

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-desk", tenantId],
    enabled: !!tenantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const today = startOfToday();
      const week = startOfWeek();
      const [newLeads, unread, hotWaiting, leakAlerts, events, msgs] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("conversations").select("id", { count: "exact", head: true }).gt("unread_count", 0),
        supabase.from("leads").select("id,name,phone,service,ai_score,ai_temperature,created_at").eq("status", "new").eq("ai_temperature", "hot").order("created_at", { ascending: true }).limit(5),
        supabase.from("lead_leakage_alerts").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", week),
        supabase.from("lead_events").select("id,type,created_at,leads(name,phone)").order("created_at", { ascending: false }).limit(8),
        supabase.from("conversation_messages").select("conversation_id,direction,created_at").gte("created_at", today).order("created_at").limit(1000),
      ]);

      const pending = new Map<string, number>();
      const diffs: number[] = [];
      for (const m of msgs.data ?? []) {
        const t = new Date(m.created_at).getTime();
        if (!m.conversation_id) continue;
        if (m.direction === "inbound" && !pending.has(m.conversation_id)) pending.set(m.conversation_id, t);
        if (m.direction === "outbound" && pending.has(m.conversation_id)) {
          diffs.push(t - pending.get(m.conversation_id)!);
          pending.delete(m.conversation_id);
        }
      }
      const avgSeconds = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length / 1000 : null;
      return {
        newLeads: newLeads.count ?? 0,
        unread: unread.count ?? 0,
        hotWaiting: hotWaiting.data ?? [],
        leakAlerts: leakAlerts.count ?? 0,
        events: events.data ?? [],
        avgSeconds,
      };
    },
  });

  const connected = ws?.profile.whatsapp_status === "connected";
  const avgLabel = data?.avgSeconds == null ? "—" : data.avgSeconds < 60 ? `${Math.round(data.avgSeconds)}s` : `${Math.round(data.avgSeconds / 60)}m`;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title={(experience ? hello + ", " + (ws?.profile.business_name ?? experience.deskName) : hello + (ws?.profile.business_name ? ", " + ws.profile.business_name : ""))}
        subtitle={experience?.subheadline ?? "This is your Revenue Desk — the few things worth acting on now."}
        action={<Button asChild className="rounded-xl"><Link to="/inbox">Work the queue <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="New enquiries today" value={String(data?.newLeads ?? "—")} />
        <Metric label="Hot leads waiting" value={String(data?.hotWaiting.length ?? "—")} emphasis={Boolean(data?.hotWaiting.length)} />
        <Metric label="Leak alerts · 7 days" value={String(data?.leakAlerts ?? "—")} />
        <Metric label="Average response" value={avgLabel} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Priority queue</p>
              <h2 className="mt-1 text-xl font-semibold">Work these first</h2>
            </div>
            <Link to="/inbox" className="text-xs font-medium text-muted-foreground hover:text-foreground">Open inbox</Link>
          </div>

          <div className="mt-5 divide-y divide-border">
            {(data?.hotWaiting ?? []).map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{lead.name || lead.phone}</p>
                    <TemperatureBadge temperature={lead.ai_temperature ?? "hot"} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[lead.service, lead.phone, timeAgo(lead.created_at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{lead.ai_score ?? "—"}/10</span>
                  <Link to="/inbox" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">Open</Link>
                </div>
              </div>
            ))}
            {(data?.hotWaiting?.length ?? 0) === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-medium">No hot {experience?.label.toLowerCase() ?? "service"} enquiry is currently waiting.</p>
                <p className="mt-1 text-xs text-muted-foreground">RevenueDesk is watching for the next high-intent {experience?.label.toLowerCase() ?? "service"} enquiry.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-background p-2 text-primary"><Bot className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{experience?.deskName ?? "AI Front Desk"}</p>
              <h2 className="mt-1 text-xl font-semibold">{experience?.headline ?? "Your business keeps replying."}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {experience?.problem ?? "RevenueDesk can handle first response, qualification and eligible follow-up, while your team takes the conversations that need a human."}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2">
            <Link to="/ai-front-desk" className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-sm">
              <span>Review Front Desk</span><ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/revenue-leaks" className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-sm">
              <span>See revenue leaks</span><ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`} />
            {connected ? "WhatsApp connected" : "Connect WhatsApp to go live"}
          </div>
        </section>
      </div>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Revenue signals</p>
            <h2 className="mt-1 text-xl font-semibold">What happened around the business</h2>
          </div>
          <Link to="/insights" className="text-xs font-medium text-muted-foreground hover:text-foreground">View insights</Link>
        </div>

        <div className="mt-4 rounded-3xl border border-border bg-card">
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading your signals…</p>
          ) : (data?.events ?? []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {(data?.events ?? []).map((event: any) => (
                <div key={event.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-lg bg-secondary p-2 text-muted-foreground">
                      {event.type === "hot_lead_leakage_alerted" ? <AlertTriangle className="h-4 w-4" /> : event.type === "auto_reply_sent" ? <Bot className="h-4 w-4" /> : event.type === "message_received" ? <Inbox className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.type.replaceAll("_", " ")}</p>
                      <p className="truncate text-xs text-muted-foreground">{event.leads?.name || event.leads?.phone || "RevenueDesk"}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(event.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketIntelligencePanel />
    </div>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card className={`p-4 ${emphasis ? "border-primary/30 bg-primary/5" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${emphasis ? "text-primary" : ""}`}>{value}</p>
    </Card>
  );
}
