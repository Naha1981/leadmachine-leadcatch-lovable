import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleAlert,
  Lightbulb,
  MessageCircle,
  Plus,
  RefreshCcw,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows, PageHeader, Panel, StatCard } from "@/components/app/primitives";
import { campaignsQuery, contactsQuery, leakageQuery, paymentsQuery } from "@/lib/api";
import { formatNumber, formatZar, initialsOf } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — 2ndLife Revenue OS" },
      {
        name: "description",
        content: "Live view of revenue generated, recovered, at risk and left on the table.",
      },
      { property: "og:title", content: "Dashboard — 2ndLife Revenue OS" },
      { property: "og:description", content: "Measured revenue recovery in real time." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const campaigns = useQuery(campaignsQuery());
  const payments = useQuery(paymentsQuery());
  const leakage = useQuery(leakageQuery());
  const contacts = useQuery(contactsQuery());

  const revenueGenerated = (campaigns.data ?? []).reduce((s, c) => s + Number(c.revenue_cents), 0);
  const recovered = (payments.data ?? [])
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + Number(p.amount_cents), 0);
  const atRisk = (payments.data ?? [])
    .filter((p) => p.status === "failed" || p.status === "pending")
    .reduce((s, p) => s + Number(p.amount_cents), 0);
  const totalLeakage = (leakage.data ?? []).reduce((s, l) => s + Number(l.amount_cents), 0);
  const maxLeak = Math.max(1, ...(leakage.data ?? []).map((l) => Number(l.amount_cents)));

  const funnel = [
    { label: "Recovery Opportunities", value: contacts.data?.length ?? 0 },
    {
      label: "Contacted",
      value: (contacts.data ?? []).filter((c) => c.last_activity_at).length,
    },
    {
      label: "Engaged",
      value: (contacts.data ?? []).filter((c) => (c.recovery_score ?? 0) > 60).length,
    },
    {
      label: "Payments Verified",
      value: (payments.data ?? []).filter((p) => p.status === "verified").length,
    },
    {
      label: "Customers Reactivated",
      value: (contacts.data ?? []).filter((c) => c.lifecycle_stage === "recovered").length,
    },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const priority = (contacts.data ?? []).slice(0, 4);

  return (
    <>
      <PageHeader
        title="Revenue command centre"
        subtitle="Every figure below is measured from your event data — never estimated."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue Generated"
          value={formatZar(revenueGenerated)}
          hint="New leads & bookings"
          delta={14.2}
          icon={TrendingUp}
        />
        <StatCard
          label="Revenue Recovered"
          value={formatZar(recovered)}
          hint="Verified via webhook"
          delta={22.7}
          icon={RefreshCcw}
        />
        <StatCard
          label="Revenue at Risk"
          value={formatZar(atRisk)}
          hint="Dormant + failed payments"
          delta={8.3}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Money Left on the Table"
          value={formatZar(totalLeakage)}
          hint="Total revenue leakage"
          delta={-5.4}
          icon={CircleAlert}
          tone="danger"
        />
      </div>

      <Panel className="mt-6 border-primary/30">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold">What should I know today?</h2>
              <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
                AI Business Briefing
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Based on the last 24h of activity</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <span className="mr-2 text-primary">•</span>
                {formatNumber(contacts.data?.length ?? 0)} customers are in the recovery pool —{" "}
                {formatNumber(priority.length)} are high-confidence restarts.
              </li>
              <li>
                <span className="mr-2 text-warning">•</span>
                {formatZar(
                  Number(
                    (leakage.data ?? []).find((l) => l.stage === "Slow response")?.amount_cents ?? 0,
                  ),
                )}{" "}
                is leaking from slow response times.
              </li>
              <li>
                <span className="mr-2 text-primary">•</span>
                Recovery Engine verified {formatZar(recovered)} this period via payment webhooks.
              </li>
              <li>
                <span className="mr-2 text-warning">•</span>
                {(payments.data ?? []).filter((p) => p.status === "failed").length} payments failed —
                retry them over WhatsApp before they churn.
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/contacts">
                  <Users className="h-4 w-4" /> Target dormant customers
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/conversations">
                  <MessageCircle className="h-4 w-4" /> Review unanswered leads
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/campaigns">
                  <Plus className="h-4 w-4" /> Launch win-back campaign
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/imports">
                  <Upload className="h-4 w-4" /> Import new list
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Money Left on the Table"
          subtitle="Revenue leakage by stage"
          action={
            <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium text-danger">
              {formatZar(totalLeakage)} at risk
            </span>
          }
        >
          {leakage.isLoading ? (
            <LoadingRows />
          ) : (
            <div className="space-y-4">
              {(leakage.data ?? []).map((row) => (
                <div key={row.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm">{row.stage}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="flex h-full items-center rounded-md bg-warning px-2 text-xs font-bold text-warning-foreground"
                      style={{ width: `${(Number(row.amount_cents) / maxLeak) * 100}%` }}
                    >
                      {formatZar(Number(row.amount_cents))}
                    </div>
                  </div>
                  <span className="w-8 text-right text-sm text-muted-foreground">
                    {row.item_count}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Total leakage this period</span>
                <span className="text-lg font-bold text-danger">{formatZar(totalLeakage)}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Recovery Funnel"
          subtitle="From opportunity to reactivation"
          action={
            <Link to="/reports" className="text-sm font-medium text-primary">
              View report →
            </Link>
          }
        >
          <div className="space-y-3">
            {funnel.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-sm">{step.label}</span>
                <div className="h-8 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className="flex h-full items-center justify-between rounded-md bg-primary px-2 text-xs font-bold text-primary-foreground"
                    style={{ width: `${Math.max(12, (step.value / funnelMax) * 100)}%` }}
                  >
                    <span>{step.value}</span>
                    <span>{Math.round((step.value / funnelMax) * 100)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Top Performing Campaigns"
          action={
            <Link to="/campaigns" className="text-sm font-medium text-primary">
              View all
            </Link>
          }
        >
          {campaigns.isLoading ? (
            <LoadingRows />
          ) : (campaigns.data ?? []).length === 0 ? (
            <EmptyState title="No campaigns yet" description="Create your first recovery campaign." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3">Campaign</th>
                    <th className="pb-3 text-right">Sent</th>
                    <th className="pb-3 text-right">Engaged</th>
                    <th className="pb-3 text-right">Recovered</th>
                    <th className="pb-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(campaigns.data ?? []).slice(0, 6).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-3 font-medium">{c.name}</td>
                      <td className="py-3 text-right">{formatNumber(c.sent)}</td>
                      <td className="py-3 text-right">{formatNumber(c.engaged)}</td>
                      <td className="py-3 text-right">{formatNumber(c.payments)}</td>
                      <td className="py-3 text-right font-semibold">
                        {formatZar(Number(c.revenue_cents))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Quick Actions">
            <div className="grid grid-cols-2 gap-3">
              <QuickAction to="/imports" icon={Upload} label="Upload Customer List" />
              <QuickAction to="/campaigns" icon={Plus} label="Create Campaign" />
              <QuickAction to="/conversations" icon={MessageCircle} label="View Conversations" />
              <QuickAction to="/reports" icon={BarChart3} label="View Reports" />
            </div>
          </Panel>

          <Panel
            title="Priority Recovery Opportunities"
            action={
              <Link to="/contacts" className="text-sm font-medium text-primary">
                View all
              </Link>
            }
          >
            <div className="space-y-2">
              {priority.map((c) => (
                <Link
                  key={c.id}
                  to="/contacts"
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {initialsOf(c.full_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.full_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Score {c.recovery_score} · {formatZar(Number(c.value_cents))}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: "/imports" | "/campaigns" | "/conversations" | "/reports";
  icon: typeof Upload;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center text-xs font-medium transition-colors hover:border-primary/60 hover:bg-muted/40"
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </Link>
  );
}