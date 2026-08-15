import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plug } from "lucide-react";

import { EmptyState, LoadingRows, PageHeader, Panel, StatusPill } from "@/components/app/primitives";
import { integrationsQuery } from "@/lib/api";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — 2ndLife Revenue OS" },
      { name: "description", content: "WhatsApp, payments and CRM connections powering the Revenue OS." },
      { property: "og:title", content: "Integrations — 2ndLife Revenue OS" },
      { property: "og:description", content: "Connect WhatsApp, payments and your CRM." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const integrations = useQuery(integrationsQuery());

  return (
    <>
      <PageHeader title="Integrations" subtitle="Channels, payments and data sources" />
      {integrations.isLoading ? (
        <LoadingRows rows={4} />
      ) : (integrations.data ?? []).length === 0 ? (
        <EmptyState title="No integrations" description="Connect WhatsApp and a payment provider to begin." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(integrations.data ?? []).map((i) => (
            <Panel key={i.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
                  <Plug className="h-5 w-5" />
                </span>
                <StatusPill tone={i.status === "connected" ? "success" : "muted"}>
                  {titleCase(i.status)}
                </StatusPill>
              </div>
              <h3 className="mt-4 font-bold">{titleCase(i.provider)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Last updated {new Date(i.updated_at).toLocaleDateString("en-ZA")}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}