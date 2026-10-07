import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Clock3, MessageCircle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, timeAgo } from "@/components/ui-bits";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { getIndustryExperience } from "@/lib/industry-experiences";

export const Route = createFileRoute("/_authenticated/_shell/revenue-leaks")({
  head: () => ({
    meta: [
      { title: "Revenue Leaks — RevenueDesk" },
      { name: "description", content: "Find unanswered, stalled and hot enquiries before they disappear." },
    ],
  }),
  component: RevenueLeaksPage,
});

function RevenueLeaksPage() {
  const { data: ws } = useWorkspace();
  const tenantId = ws?.tenantId;
  const experience = getIndustryExperience(ws?.profile.industry);

  const { data, isLoading } = useQuery({
    queryKey: ["revenue-leaks", tenantId],
    enabled: !!tenantId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [hot, alerts, unread] = await Promise.all([
        supabase.from("leads").select("id,name,phone,service,ai_score,ai_temperature,created_at,status").eq("status", "new").eq("ai_temperature", "hot").order("created_at", { ascending: true }).limit(20),
        supabase.from("lead_leakage_alerts").select("id,lead_id,status,created_at,alerted_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("conversations").select("id", { count: "exact", head: true }).gt("unread_count", 0),
      ]);
      return { hot: hot.data ?? [], alerts: alerts.data ?? [], unread: unread.count ?? 0 };
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title={experience ? experience.label + " Revenue Leaks" : "Revenue Leaks"}
        subtitle={experience ? experience.problem + " " + experience.outcome : "RevenueDesk shows where customer intent is stalling before it becomes lost work."}
        action={<Button asChild className="rounded-xl"><Link to="/inbox">Work the queue <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Hot leads waiting" value={String(data?.hot.length ?? "—")} danger={Boolean(data?.hot.length)} />
        <Metric label="Unread conversations" value={String(data?.unread ?? "—")} danger={Boolean(data?.unread)} />
        <Metric label="Leak alerts recorded" value={String(data?.alerts.length ?? "—")} />
      </div>

      <section className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldAlert className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Needs action</p>
              <h2 className="mt-1 text-xl font-semibold">High-intent {experience?.label.toLowerCase() ?? "service"} enquiries sitting in “new”</h2>
              <p className="mt-1 text-sm text-muted-foreground">{experience?.outcome ?? "These are the customers RevenueDesk believes are most ready to buy and are still waiting for progress."}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Scanning the queue…</p>
        ) : (data?.hot.length ?? 0) === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium">Nothing obvious is leaking right now.</p>
            <p className="mt-1 text-xs text-muted-foreground">RevenueDesk will keep watching.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(data?.hot ?? []).map((lead: any) => (
              <div key={lead.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{lead.name || lead.phone}</p>
                    <TemperatureBadge temperature={lead.ai_temperature ?? "hot"} />
                    <span className="text-xs text-muted-foreground">{timeAgo(lead.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{lead.service || "Service enquiry"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{lead.ai_score ?? "—"}/10</span>
                  <Button asChild size="sm" variant="outline" className="rounded-xl"><Link to="/inbox">Open conversation</Link></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {(experience?.leakTypes ?? ["Slow response", "Unanswered conversation", "Recovery alert"]).map((text, index) => (
          <LeakType
            key={text}
            icon={index === 0 ? Clock3 : index === 1 ? MessageCircle : AlertTriangle}
            title={index === 0 ? "First leak to fix" : index === 1 ? "Conversation at risk" : "Recovery opportunity"}
            text={text}
          />
        ))}
      </section>

      {experience && (
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">What RevenueDesk watches for</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {experience.services.map((service) => (
              <span key={service} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">{service}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return <Card className={`p-4 ${danger ? "border-primary/30 bg-primary/5" : ""}`}><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-3xl font-semibold ${danger ? "text-primary" : ""}`}>{value}</p></Card>;
}

function LeakType({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return <Card className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></Card>;
}
