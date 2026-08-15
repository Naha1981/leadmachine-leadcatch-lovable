import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusPill } from "@/components/app/primitives";
import { contactsQuery } from "@/lib/api";
import { formatZar, initialsOf, relativeTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Customers — 2ndLife Revenue OS" },
      { name: "description", content: "Every customer, scored for recovery potential and lifetime value." },
      { property: "og:title", content: "Customers — 2ndLife Revenue OS" },
      { property: "og:description", content: "Recovery-scored customer database." },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const contacts = useQuery(contactsQuery());
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (contacts.data ?? []).filter(
      (c) =>
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [contacts.data, term]);

  return (
    <>
      <PageHeader title="Customers" subtitle="Scored for recovery potential" />
      <Panel>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name, phone or email"
          maxLength={80}
          className="mb-4 max-w-sm"
        />
        {contacts.isLoading ? (
          <LoadingRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No customers found" description="Import a list to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Stage</th>
                  <th className="pb-3 text-right">Score</th>
                  <th className="pb-3 text-right">Value</th>
                  <th className="pb-3 text-right">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
                          {initialsOf(c.full_name)}
                        </span>
                        <span>
                          <span className="block font-medium">{c.full_name}</span>
                          <span className="block text-xs text-muted-foreground">{c.phone ?? c.email ?? "—"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <StatusPill
                        tone={
                          c.lifecycle_stage === "recovered"
                            ? "success"
                            : c.lifecycle_stage === "dormant" || c.lifecycle_stage === "lapsed"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {titleCase(c.lifecycle_stage)}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-right font-semibold">{c.recovery_score}</td>
                    <td className="py-3 text-right">{formatZar(Number(c.value_cents))}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {relativeTime(c.last_activity_at)}
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