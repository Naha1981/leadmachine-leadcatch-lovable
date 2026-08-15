import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radar, Sparkles, TrendingUp } from "lucide-react";

import { EmptyState, LoadingRows, PageHeader, Panel, StatCard, StatusPill } from "@/components/app/primitives";
import { opportunitiesQuery, signalsQuery } from "@/lib/api";
import { formatNumber, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/demand")({
  head: () => ({
    meta: [
      { title: "Demand Radar — 2ndLife Revenue OS" },
      {
        name: "description",
        content: "Emerging demand topics and content opportunities detected from real customer questions.",
      },
      { property: "og:title", content: "Demand Radar — 2ndLife Revenue OS" },
      { property: "og:description", content: "See what your market is asking for right now." },
    ],
  }),
  component: DemandPage,
});

function DemandPage() {
  const signals = useQuery(signalsQuery());
  const opportunities = useQuery(opportunitiesQuery());

  const rising = (signals.data ?? []).filter((s) => s.status === "opportunity").length;
  const totalFrequency = (signals.data ?? []).reduce((s, x) => s + x.frequency, 0);
  const avgIntent =
    (signals.data ?? []).length > 0
      ? Math.round(
          (signals.data ?? []).reduce((s, x) => s + x.intent_score, 0) / (signals.data ?? []).length,
        )
      : 0;

  return (
    <>
      <PageHeader
        title="Demand Radar & Marketing Brain"
        subtitle="Detected from real questions your customers are asking across WhatsApp, search and reviews."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Opportunity topics" value={formatNumber(rising)} icon={TrendingUp} />
        <StatCard label="Signals captured" value={formatNumber(totalFrequency)} icon={Radar} />
        <StatCard label="Average intent score" value={`${avgIntent}/100`} icon={Sparkles} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Emerging demand" subtitle="Ranked by frequency and intent">
          {signals.isLoading ? (
            <LoadingRows />
          ) : (signals.data ?? []).length === 0 ? (
            <EmptyState title="No signals yet" description="Connect a channel to start detecting demand." />
          ) : (
            <ul className="space-y-3">
              {(signals.data ?? []).map((s) => (
                <li key={s.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{s.topic}</span>
                    <StatusPill
                      tone={
                        s.status === "opportunity"
                          ? "success"
                          : s.status === "watching"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {titleCase(s.status)}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatNumber(s.frequency)} mentions · source {s.source}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.intent_score}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Intent {s.intent_score}/100</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Content opportunities" subtitle="Turn demand into distribution">
          {opportunities.isLoading ? (
            <LoadingRows />
          ) : (opportunities.data ?? []).length === 0 ? (
            <EmptyState title="No opportunities yet" description="Opportunities appear as signals mature." />
          ) : (
            <ul className="space-y-3">
              {(opportunities.data ?? []).map((o) => (
                <li key={o.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{o.topic}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(o.occurrences)} occurrences
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">“{o.hook}”</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.formats.map((f) => (
                      <span key={f} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-medium text-primary">CTA: {o.cta}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}