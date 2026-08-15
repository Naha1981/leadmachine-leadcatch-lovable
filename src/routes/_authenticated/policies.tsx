import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, LoadingRows, PageHeader, Panel, StatusPill } from "@/components/app/primitives";
import { policiesQuery } from "@/lib/api";
import { formatZar, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/policies")({
  head: () => ({
    meta: [
      { title: "Policies — 2ndLife Revenue OS" },
      { name: "description", content: "Active, lapsed and at-risk policies with premium value." },
      { property: "og:title", content: "Policies — 2ndLife Revenue OS" },
      { property: "og:description", content: "Track policy status and premium exposure." },
    ],
  }),
  component: PoliciesPage,
});

function PoliciesPage() {
  const policies = useQuery(policiesQuery());

  return (
    <>
      <PageHeader title="Policies" subtitle="Premium exposure across your book" />
      <Panel>
        {policies.isLoading ? (
          <LoadingRows rows={6} />
        ) : (policies.data ?? []).length === 0 ? (
          <EmptyState title="No policies yet" description="Import your policy book to begin." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3">Policy</th>
                  <th className="pb-3">Holder</th>
                  <th className="pb-3">Product</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Premium</th>
                  <th className="pb-3 text-right">Next due</th>
                </tr>
              </thead>
              <tbody>
                {(policies.data ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-3 font-medium">{p.policy_number}</td>
                    <td className="py-3">{p.contacts?.full_name ?? "—"}</td>
                    <td className="py-3">{p.product}</td>
                    <td className="py-3">
                      <StatusPill
                        tone={p.status === "active" ? "success" : p.status === "lapsed" ? "danger" : "warning"}
                      >
                        {titleCase(p.status)}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-right">{formatZar(Number(p.premium_cents))}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {p.next_due_at ? new Date(p.next_due_at).toLocaleDateString("en-ZA") : "—"}
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