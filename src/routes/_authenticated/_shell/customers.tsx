import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, PageHeader } from "@/components/ui-bits";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/_shell/customers")({
  head: () => ({
    meta: [
      { title: "Customers — RevenueDesk" },
      { name: "description", content: "Recurring customers and when each one is next due for a service." },
    ],
  }),
  component: CustomersPage,
});

type Customer = Tables<"service_customers">;

const fmtCents = (c: number) => `R${(c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00");
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—";

function CustomersPage() {
  const { data: ws } = useWorkspace();
  const tenantId = ws?.tenantId;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", every: "30", monthly: "" });

  const list = useQuery({
    queryKey: ["service-customers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_customers").select("*").order("name").limit(500);
      if (error) throw error;
      return data as Customer[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["service-customers"] });

  const add = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Still loading your workspace.");
      if (!f.name.trim()) throw new Error("Enter the customer's name.");
      const every = f.every.trim() ? Number(f.every) : null;
      if (every !== null && (!Number.isInteger(every) || every < 1 || every > 730)) throw new Error("Service interval must be 1 to 730 days.");
      const rands = f.monthly.trim() ? Number(f.monthly.replace(/[^0-9.,]/g, "").replace(",", ".")) : null;
      const { error } = await supabase.from("service_customers").insert({
        tenant_id: tenantId,
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        service_every_days: every,
        monthly_value_cents: rands !== null && Number.isFinite(rands) ? Math.round(rands * 100) : null,
        last_service_on: todayISO(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setF({ name: "", phone: "", every: "30", monthly: "" }); setOpen(false); refresh(); toast.success("Customer added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the customer"),
  });

  const serviced = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_customers").update({ last_service_on: todayISO() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Marked as serviced today"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const t = todayISO();
  const dueCount = (list.data ?? []).filter((c) => {
    if (!c.service_every_days) return false;
    const next = addDays(c.last_service_on, c.service_every_days);
    return next <= t;
  }).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Customers"
        subtitle="Recurring customers and when each one is next due. RevenueDesk flags overdue services so the contract never quietly lapses."
        action={<Button className="rounded-xl" onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Add a customer"}</Button>}
      />

      {dueCount > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <span className="font-semibold text-amber-600">{dueCount} service{dueCount === 1 ? "" : "s"} due or overdue</span>
          <span className="text-muted-foreground"> - book them before the customer calls someone else.</span>
        </div>
      )}

      {open && (
        <Card className="p-5">
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cn">Name</Label>
              <Input id="cn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cp">Phone</Label>
              <Input id="cp" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ce">Serviced every (days)</Label>
              <Input id="ce" inputMode="numeric" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} />
              <p className="text-xs text-muted-foreground">Leave blank for one-off customers.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cm">Monthly fee (R, optional)</Label>
              <Input id="cm" inputMode="decimal" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="rounded-xl" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save customer"}</Button>
            </div>
          </form>
        </Card>
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading customers…</p>
      ) : !list.data?.length ? (
        <Card className="p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No customers yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add the customers you service regularly and RevenueDesk tells you when each is due.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.data.map((c) => {
            const next = c.service_every_days ? addDays(c.last_service_on, c.service_every_days) : null;
            const overdue = next !== null && next <= t;
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.phone || "No phone"}{c.monthly_value_cents ? ` · ${fmtCents(c.monthly_value_cents)}/month` : ""}
                    </p>
                  </div>
                  {c.service_every_days ? (
                    overdue
                      ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Service due</span>
                      : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Next {fmtDate(next)}</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">One-off</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.phone && <Button asChild size="sm" variant="outline" className="rounded-xl"><a href={`tel:${c.phone}`}>Call</a></Button>}
                  {c.service_every_days && <Button size="sm" className="rounded-xl" onClick={() => serviced.mutate(c.id)}>Serviced today</Button>}
                  <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => { if (window.confirm(`Remove ${c.name}?`)) del.mutate(c.id); }}>Remove</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
