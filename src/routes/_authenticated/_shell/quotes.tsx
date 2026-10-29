import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, PageHeader } from "@/components/ui-bits";
import { getIndustryExperience } from "@/lib/industry-experiences";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/_shell/quotes")({
  head: () => ({
    meta: [
      { title: "Quotes — RevenueDesk" },
      { name: "description", content: "Track sent quotes and chase the ones going quiet." },
    ],
  }),
  component: QuotesPage,
});

type Quote = Tables<"quotes">;

const fmtCents = (c: number) => `R${(c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00");
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "—";

function QuotesPage() {
  const { data: ws } = useWorkspace();
  const tenantId = ws?.tenantId;
  const experience = getIndustryExperience(ws?.profile.industry);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customer: "", title: "", amount: "" });

  const list = useQuery({
    queryKey: ["quotes", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as Quote[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["quotes"] });

  const add = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Still loading your workspace.");
      if (!f.customer.trim()) throw new Error("Enter the customer's name.");
      const rands = Number(f.amount.replace(/[^0-9.,]/g, "").replace(",", "."));
      const { error } = await supabase.from("quotes").insert({
        tenant_id: tenantId,
        customer_name: f.customer.trim(),
        title: f.title.trim(),
        amount_cents: Number.isFinite(rands) ? Math.round(rands * 100) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { setF({ customer: "", title: "", amount: "" }); setOpen(false); refresh(); toast.success("Quote logged - chase reminder set for 3 days."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the quote"),
  });

  const upd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("quotes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the quote"),
  });

  const t = todayISO();
  const waiting = (list.data ?? []).filter((q) => q.status === "sent");
  const decided = (list.data ?? []).filter((q) => q.status !== "sent");
  const chaseCount = waiting.filter((q) => q.follow_up_on <= t).length;

  const QuoteCard = ({ q }: { q: Quote }) => {
    const due = q.status === "sent" && q.follow_up_on <= t;
    return (
      <li className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{q.customer_name}</p>
            {q.title && <p className="text-sm text-muted-foreground">{q.title}</p>}
          </div>
          <p className="text-lg font-bold">{fmtCents(q.amount_cents)}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={`rounded-full px-2 py-0.5 font-medium ${q.status === "won" ? "bg-primary/10 text-primary" : q.status === "lost" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-600"}`}>
            {q.status === "sent" ? "Waiting" : q.status === "won" ? "Won" : "Lost"}
          </span>
          <span>Sent {fmtDate(q.sent_on)}</span>
          {q.status === "sent" && (due
            ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">Chase now - 3 days quiet</span>
            : <span>Chase on {fmtDate(q.follow_up_on)}</span>)}
        </div>
        {q.status === "sent" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-xl" onClick={() => upd.mutate({ id: q.id, patch: { status: "won" } })}>Won</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => upd.mutate({ id: q.id, patch: { follow_up_on: addDays(t, 3) } })}>Chased, check in 3 days</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => upd.mutate({ id: q.id, patch: { status: "lost" } })}>Lost</Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Quotes"
        subtitle={`Quotes you sent that are waiting for a yes. RevenueDesk flags any quote that goes quiet for 3 days so the deal does not slip away.`}
        action={<Button className="rounded-xl" onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Log a quote"}</Button>}
      />

      {chaseCount > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span className="font-semibold text-destructive">{chaseCount} quote{chaseCount === 1 ? "" : "s"} to chase now</span>
          <span className="text-muted-foreground"> - quiet for 3 days or more. A same-day chase wins a third of these.</span>
        </div>
      )}

      {open && (
        <Card className="p-5">
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="qc">Customer</Label>
              <Input id="qc" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="e.g. Mrs Nkosi" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qt">Job</Label>
              <Input id="qt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Geyser replacement" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qa">Amount (R)</Label>
              <Input id="qa" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="e.g. 8500" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" className="rounded-xl" disabled={add.isPending}>{add.isPending ? "Saving…" : "Save quote"}</Button>
            </div>
          </form>
        </Card>
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading quotes…</p>
      ) : !list.data?.length ? (
        <Card className="p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No quotes yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Log each quote you send. RevenueDesk reminds you to chase after 3 quiet days.</p>
        </Card>
      ) : (
        <>
          <p className="text-sm font-medium">
            Waiting for an answer: {waiting.length} · {fmtCents(waiting.reduce((s, q) => s + q.amount_cents, 0))}
          </p>
          <ul className="space-y-3">{waiting.map((q) => <QuoteCard key={q.id} q={q} />)}</ul>
          {decided.length > 0 && (
            <>
              <h2 className="pt-4 text-lg font-semibold">Decided</h2>
              <ul className="space-y-3">{decided.map((q) => <QuoteCard key={q.id} q={q} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
