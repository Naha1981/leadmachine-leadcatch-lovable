import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, Panel, StatCard } from "@/components/app/primitives";
import { campaignsQuery, leakageQuery, paymentsQuery } from "@/lib/api";
import { formatNumber, formatPercent, formatZar } from "@/lib/format";
import { BarChart3, PiggyBank, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — 2ndLife Revenue OS" },
      { name: "description", content: "Attribution reporting across campaigns, payments and leakage." },
      { property: "og:title", content: "Reports — 2ndLife Revenue OS" },
      { property: "og:description", content: "Proof of recovered revenue, not vanity metrics." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const campaigns = useQuery(campaignsQuery());
  const payments = useQuery(paymentsQuery());
  const leakage = useQuery(leakageQuery());

  const rows = campaigns.data ?? [];
  const totalSent = rows.reduce((s, c) => s + c.sent, 0);
  const totalPayments = rows.reduce((s, c) => s + c.payments, 0);
  const revenue = rows.reduce((s, c) => s + Number(c.revenue_cents), 0);
  const verified = (payments.data ?? []).filter((p) => p.status === "verified").length;
  const leaked = (leakage.data ?? []).reduce((s, l) => s + Number(l.amount_cents), 0);

  return (
    <>
      <PageHeader title="Reports" subtitle="Attribution from message sent to rand received" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Attributed revenue" value={formatZar(revenue)} icon={PiggyBank} />
        <StatCard
          label="Send-to-payment rate"
          value={formatPercent(totalSent > 0 ? (totalPayments / totalSent) * 100 : 0)}
          icon={Target}
        />
        <StatCard label="Recoverable leakage" value={formatZar(leaked)} icon={BarChart3} tone="warning" />
      </div>

      <Panel className="mt-6" title="Campaign attribution" subtitle={`${verified} verified payments`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-3">Campaign</th>
                <th className="pb-3 text-right">Sent</th>
                <th className="pb-3 text-right">Engaged</th>
                <th className="pb-3 text-right">Payments</th>
                <th className="pb-3 text-right">Revenue</th>
                <th className="pb-3 text-right">Rev / send</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-3 font-medium">{c.name}</td>
                  <td className="py-3 text-right">{formatNumber(c.sent)}</td>
                  <td className="py-3 text-right">{formatNumber(c.engaged)}</td>
                  <td className="py-3 text-right">{formatNumber(c.payments)}</td>
                  <td className="py-3 text-right font-semibold">{formatZar(Number(c.revenue_cents))}</td>
                  <td className="py-3 text-right text-muted-foreground">
                    {formatZar(c.sent > 0 ? Number(c.revenue_cents) / c.sent : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}