import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, XCircle } from "lucide-react";

import { EmptyState, LoadingRows, PageHeader, Panel, StatCard, StatusPill } from "@/components/app/primitives";
import { paymentsQuery } from "@/lib/api";
import { formatZar, relativeTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — 2ndLife Revenue OS" },
      { name: "description", content: "Verified, pending and failed payments across every recovery campaign." },
      { property: "og:title", content: "Payments — 2ndLife Revenue OS" },
      { property: "og:description", content: "Webhook-verified recovery revenue." },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const payments = useQuery(paymentsQuery());
  const rows = payments.data ?? [];
  const sum = (status: string) =>
    rows.filter((p) => p.status === status).reduce((s, p) => s + Number(p.amount_cents), 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Every rand verified by payment webhook" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Verified" value={formatZar(sum("verified"))} icon={BadgeCheck} />
        <StatCard label="Pending" value={formatZar(sum("pending"))} icon={Clock} tone="warning" />
        <StatCard label="Failed" value={formatZar(sum("failed"))} icon={XCircle} tone="danger" />
      </div>

      <Panel className="mt-6">
        {payments.isLoading ? (
          <LoadingRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No payments yet" description="Payments appear once a campaign converts." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3">Reference</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Provider</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-right">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-3 font-mono text-xs">{p.reference}</td>
                    <td className="py-3">{p.contacts?.full_name ?? "—"}</td>
                    <td className="py-3">{titleCase(p.provider)}</td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          p.status === "verified" ? "success" : p.status === "failed" ? "danger" : "warning"
                        }
                      >
                        {titleCase(p.status)}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-right font-semibold">{formatZar(Number(p.amount_cents))}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {relativeTime(p.verified_at ?? p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}