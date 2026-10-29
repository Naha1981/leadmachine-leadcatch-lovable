import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getTrialState, trialNow, paymentReference, TRIAL_DAYS } from "@/lib/trial";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Subscribe — RevenueDesk" }, { name: "description", content: "Subscribe to keep your RevenueDesk running." }] }),
  component: Billing,
});

const PAYFAST_ENABLED = (import.meta.env as Record<string, string | undefined>)["VITE_PAYFAST_ENABLED"] === "true";
const WHATSAPP_NUMBER = "27612980377";

type PayfastForm = { action_url: string; fields: Record<string, string> };

async function fetchPayfastForm(reference: string): Promise<PayfastForm> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue");
  const r = await fetch(`${window.location.origin}/bridge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "payfast-link", reference }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.action_url) throw new Error(j?.error ?? "Payment service unreachable");
  return j as PayfastForm;
}

function submitPayfast(form: PayfastForm) {
  const f = document.createElement("form");
  f.method = "POST";
  f.action = form.action_url;
  for (const [k, v] of Object.entries(form.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v;
    f.appendChild(input);
  }
  document.body.appendChild(f);
  f.submit();
}

type Plan = { id: string; name: string; price: number; blurb: string };

const PLANS: Plan[] = [
  { id: "starter", name: "Starter", price: 499, blurb: "Centralised lead capture, basic lead management and tracking, customer enquiry management." },
  { id: "growth", name: "Growth", price: 999, blurb: "Everything in Starter, plus enhanced lead tracking and follow-up workflows, lead prioritisation and reporting." },
  { id: "business-pro", name: "Business Pro", price: 1999, blurb: "Everything in Growth, plus advanced workflows and integrations where supported, enhanced reporting and multi-user requirements." },
];

function formatRand(n: number): string {
  return "R" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function whatsappPayUrl(reference: string, plan: Plan): string {
  const text = `Hi NahaLabs, I want to pay my RevenueDesk ${plan.name} subscription (${formatRand(plan.price)}/month). My payment reference is ${reference}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text).replace(/%20/g, "+")}`;
}

function Billing() {
  const { data: ws } = useWorkspace();
  const trial = getTrialState(ws?.profile, trialNow());
  const ref = ws ? paymentReference(ws.tenantId, (ws.profile as { payment_reference?: string | null }).payment_reference) : "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string>("starter");
  const plan: Plan = PLANS.find((pl) => pl.id === planId) ?? (PLANS[0] as Plan);
  const paid = new URLSearchParams(window.location.search).get("paid") === "1";
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{trial.locked ? `Your ${TRIAL_DAYS}-day trial has ended` : "Subscribe to RevenueDesk"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {trial.locked ? "Your data is safe. Subscribe to unlock your dashboard." : "Subscribe any time to keep RevenueDesk running after your trial."}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-2">
          {PLANS.map((pl) => (
            <button
              key={pl.id}
              type="button"
              data-testid={`plan-${pl.id}`}
              onClick={() => setPlanId(pl.id)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${pl.id === plan.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"}`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{pl.name}</span>
                <span className="font-semibold">{formatRand(pl.price)}<span className="text-xs font-normal text-muted-foreground">/month</span></span>
              </span>
              <span className="mt-1 block text-xs leading-4 text-muted-foreground">{pl.blurb}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-3xl font-semibold">{formatRand(plan.price)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
        <p className="mt-1 text-xs text-muted-foreground">No setup fee. Cancel any time. WhatsApp messaging charges, where applicable, are billed separately by usage.</p>
        {paid ? (
          <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2.5 text-sm font-medium">Payment received. We activate your subscription as soon as it clears.</p>
        ) : PAYFAST_ENABLED && plan.id === "starter" ? (
          <Button
            data-testid="subscribe-button"
            className="mt-4 w-full"
            size="lg"
            disabled={busy || !ws}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                submitPayfast(await fetchPayfastForm(ref));
              } catch (e) {
                setError(e instanceof Error ? e.message : "Payment service unreachable");
                setBusy(false);
              }
            }}
          >
            {busy ? "Opening secure payment…" : `Subscribe - ${formatRand(plan.price)}/month`}
          </Button>
        ) : null}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <div className="mt-4 flex justify-between gap-4 rounded-xl bg-primary/10 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Payment reference</span>
          <span data-testid="payment-reference" className="font-mono font-semibold">{ref}</span>
        </div>
        <a
          data-testid="whatsapp-pay-link"
          href={whatsappPayUrl(ref, plan)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4" /> Pay by WhatsApp - 061 298 0377
        </a>
        <p className="mt-4 text-xs text-muted-foreground">Tap Pay by WhatsApp and your reference goes with the message automatically. We activate your account within one business day of your payment reflecting.</p>
      </div>
    </div>
  );
}
