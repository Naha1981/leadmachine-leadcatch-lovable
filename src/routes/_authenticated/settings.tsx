import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { profileQuery } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — 2ndLife Revenue OS" },
      { name: "description", content: "Workspace, account and notification settings for your Revenue OS." },
      { property: "og:title", content: "Settings — 2ndLife Revenue OS" },
      { property: "og:description", content: "Manage your workspace and account." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const profile = useQuery(profileQuery(user?.id));
  const tenant = profile.data?.tenants as { name?: string; currency?: string } | null | undefined;

  return (
    <>
      <PageHeader title="Settings" subtitle="Workspace and account" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Workspace">
          <dl className="space-y-3 text-sm">
            <Row label="Workspace" value={tenant?.name ?? "—"} />
            <Row label="Currency" value={tenant?.currency ?? "ZAR"} />
            <Row label="Region" value="South Africa" />
          </dl>
        </Panel>
        <Panel title="Account">
          <dl className="space-y-3 text-sm">
            <Row label="Name" value={profile.data?.full_name ?? "—"} />
            <Row label="Email" value={user?.email ?? "—"} />
          </dl>
          <Button variant="outline" className="mt-5" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-3 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}