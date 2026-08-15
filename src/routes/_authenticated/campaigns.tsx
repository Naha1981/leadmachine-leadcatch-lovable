import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, LoadingRows, PageHeader, Panel, StatusPill } from "@/components/app/primitives";
import { campaignsQuery } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatNumber, formatPercent, formatZar, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — 2ndLife Revenue OS" },
      { name: "description", content: "WhatsApp recovery campaigns with measured revenue outcomes." },
      { property: "og:title", content: "Campaigns — 2ndLife Revenue OS" },
      { property: "og:description", content: "Launch and measure WhatsApp recovery campaigns." },
    ],
  }),
  component: CampaignsPage,
});

const schema = z.object({
  name: z.string().trim().min(3, "Campaign name is too short").max(80),
  product: z.string().trim().min(2).max(60),
  audience: z.string().trim().min(2).max(60),
});

function CampaignsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const campaigns = useQuery(campaignsQuery());
  const [open, setOpen] = useState(false);

  const createCampaign = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!profile) throw new Error("No workspace found for this account");
      const { error } = await supabase.from("campaigns").insert({
        tenant_id: profile.tenant_id,
        name: values.name,
        product: values.product,
        audience: values.audience,
        status: "draft",
        created_by: user!.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Campaign created");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      name: form.get("name"),
      product: form.get("product"),
      audience: form.get("audience"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    createCampaign.mutate(parsed.data);
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="WhatsApp recovery campaigns"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a recovery campaign</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign name</Label>
                  <Input id="name" name="name" placeholder="August Win-back" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product">Product</Label>
                  <Input id="product" name="product" defaultValue="Funeral Insurance" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audience">Audience</Label>
                  <Input id="audience" name="audience" defaultValue="Lapsed policies" required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createCampaign.isPending}>
                    Create campaign
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {campaigns.isLoading ? (
        <LoadingRows rows={3} />
      ) : (campaigns.data ?? []).length === 0 ? (
        <EmptyState title="No campaigns yet" description="Create your first recovery campaign." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(campaigns.data ?? []).map((c) => {
            const conversion = c.sent > 0 ? (c.payments / c.sent) * 100 : 0;
            return (
              <Panel key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold">{c.name}</h3>
                  <StatusPill
                    tone={
                      c.status === "completed" ? "success" : c.status === "running" ? "info" : "muted"
                    }
                  >
                    {titleCase(c.status)}
                  </StatusPill>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.product} · created {new Date(c.created_at).toLocaleDateString("en-ZA")}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <Metric label="Sent" value={formatNumber(c.sent)} />
                  <Metric label="Engaged" value={formatNumber(c.engaged)} />
                  <Metric label="Payments" value={formatNumber(c.payments)} />
                  <Metric
                    label="Revenue"
                    value={formatZar(Number(c.revenue_cents))}
                    accent
                  />
                </dl>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">
                    Conversion <strong className="text-foreground">{formatPercent(conversion)}</strong>
                  </span>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={accent ? "text-lg font-bold text-primary" : "text-lg font-bold"}>{value}</dd>
    </div>
  );
}