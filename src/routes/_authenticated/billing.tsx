import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace";
import { Logo } from "@/components/Logo";
import { getTrialState, trialNow, paymentReference, MONTHLY_PRICE_RAND, TRIAL_DAYS } from "@/lib/trial";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Subscribe — RevenueDesk" }, { name: "description", content: "Pay by EFT to keep your RevenueDesk running." }] }),
  component: Billing,
});

const env = import.meta.env as Record<string, string | undefined>;
const BANK = [
  ["Account name", env["VITE_EFT_ACCOUNT_NAME"]],
  ["Bank", env["VITE_EFT_BANK"]],
  ["Account number", env["VITE_EFT_ACCOUNT_NUMBER"]],
  ["Branch code", env["VITE_EFT_BRANCH_CODE"]],
] as const;

function Billing() {
  const { data: ws } = useWorkspace();
  const trial = getTrialState(ws?.profile, trialNow());
  const ref = ws ? paymentReference(ws.tenantId, (ws.profile as { payment_reference?: string | null }).payment_reference) : "";
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 p-6">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{trial.locked ? `Your ${TRIAL_DAYS}-day trial has ended` : "Subscribe to RevenueDesk"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {trial.locked ? "Your data is safe. Pay by EFT to unlock your dashboard." : "Pay by EFT any time to keep RevenueDesk running after your trial."}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-3xl font-semibold">R{MONTHLY_PRICE_RAND}<span className="text-sm font-normal text-muted-foreground"> / month, flat</span></p>
        <p className="mt-1 text-xs text-muted-foreground">Unlimited seats. No setup fee. Cancel any time.</p>
        <dl className="mt-5 space-y-3 text-sm">
          {BANK.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value ?? "Sent to you by email"}</dd></div>
          ))}
          <div className="flex justify-between gap-4 rounded-xl bg-primary/10 px-3 py-2.5">
            <dt className="text-muted-foreground">Payment reference</dt>
            <dd data-testid="payment-reference" className="font-mono font-semibold">{ref}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Use this exact reference. We activate your account within one business day of your payment reflecting.</p>
      </div>
    </div>
  );
}
