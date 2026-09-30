import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Play, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui-bits";
import { runSalesWorker } from "@/lib/agent-workforce.functions";
import {
  approveSalesExecution,
  getSalesExecution,
  rejectSalesExecution,
} from "@/lib/agent-workforce-execution.functions";
import type { SalesExecutionStatus, SalesWorkerResult } from "@/lib/agent-workforce/contracts";

export function AgentWorkforcePanel() {
  const runWorker = useServerFn(runSalesWorker);
  const approveAction = useServerFn(approveSalesExecution);
  const rejectAction = useServerFn(rejectSalesExecution);
  const getExecution = useServerFn(getSalesExecution);

  const [businessName, setBusinessName] = useState("Demo Service Business");
  const [websiteUrl, setWebsiteUrl] = useState("https://example.com");
  const [location, setLocation] = useState("Johannesburg");
  const [contactName, setContactName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [category] = useState("Service business");
  const [busy, setBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [result, setResult] = useState<SalesWorkerResult | null>(null);
  const [execution, setExecution] = useState<SalesExecutionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshExecution = useCallback(async (actionId: string) => {
    try {
      const value = await getExecution({ data: { actionId } });
      setExecution(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh execution status.");
    }
  }, [getExecution]);

  useEffect(() => {
    const actionId = result?.approvalActionId;
    const approvalStatus = execution?.approval?.status;
    const actionStatus = execution?.action.status;
    if (!actionId || approvalStatus !== "approved" || actionStatus === "completed" || actionStatus === "failed" || actionStatus === "rejected") {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshExecution(actionId);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [result?.approvalActionId, execution?.approval?.status, execution?.action.status, refreshExecution]);

  async function run() {
    setBusy(true);
    setError(null);
    setExecution(null);
    try {
      const value = await runWorker({
        data: {
          businessName,
          websiteUrl,
          location,
          category,
          contactName: contactName || undefined,
          prospectPhone: prospectPhone || undefined,
        },
      });
      setResult(value);
      if (value.approvalActionId) await refreshExecution(value.approvalActionId);
      toast.success("Sales Worker completed its evidence scan and created an approval.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The worker could not complete the scan.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approved" | "rejected") {
    const actionId = result?.approvalActionId;
    if (!actionId) return;
    setDecisionBusy(true);
    setError(null);
    try {
      if (decision === "approved") {
        await approveAction({ data: { actionId } });
        toast.success("Approved. Zero UI will execute the queued sales action.");
      } else {
        await rejectAction({ data: { actionId } });
        toast.success("Execution rejected. No external action will run.");
      }
      await refreshExecution(actionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The approval could not be updated.");
    } finally {
      setDecisionBusy(false);
    }
  }

  const approvalStatus = execution?.approval?.status ?? "pending";
  const actionStatus = execution?.action.status ?? "pending";

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Sales Worker"
        subtitle="Evidence → diagnosis → approval → execution → receipts."
      />

      <Card className="space-y-4 border-primary/20 bg-primary/[0.03]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              NahaLabs Agent Workforce
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              LeadMachine finds a specific public revenue signal, shows the evidence and prepares an
              approved execution path for the prospect.
            </p>
          </div>
          <div className="rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs font-medium text-primary">
            Revenue wedge · Sales
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://business.co.za"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Johannesburg"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name (optional)"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={prospectPhone}
            onChange={(e) => setProspectPhone(e.target.value)}
            placeholder="+27 prospect WhatsApp (optional)"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            onClick={run}
            disabled={busy || !businessName.trim() || !websiteUrl.trim()}
            className="h-11 rounded-xl"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {busy ? "Researching…" : "Run Sales Worker"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The scan sends no outreach. Prospect WhatsApp and Remotion execution stay behind the approval record.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </Card>

      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {result.runtimes.map((runtime) => (
              <Card key={runtime.kind} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {runtime.kind === "openmuse" ? "OpenMuse" : "OpenBot"}
                  </p>
                  {runtime.reachable ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {runtime.configured ? "offline" : "not configured"}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{runtime.message}</p>
                {runtime.capabilities.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {runtime.capabilities.join(" · ")}
                  </p>
                )}
              </Card>
            ))}

            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Run</p>
              <p className="mt-2 font-mono text-xs">{result.runId}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(result.completedAt).toLocaleString()}
              </p>
            </Card>
          </div>

          <Card className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">Evidence pack</p>
                <p className="text-xs text-muted-foreground">
                  Findings are only as strong as the underlying observed evidence.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                External execution requires approval
              </span>
            </div>

            <div className="grid gap-3">
              {result.findings.map((finding) => (
                <div key={finding.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start gap-3">
                    {finding.severity === "opportunity" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{finding.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{finding.detail}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {finding.evidenceIds.map((id) => {
                          const item = result.evidence.find((e) => e.id === id);
                          return item ? (
                            <a
                              key={id}
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              SOURCE · {item.title} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">Approval gate</p>
                <p className="text-xs text-muted-foreground">
                  Approving releases the queued worker to create the prospect video and send the approved WhatsApp outreach.
                </p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                {approvalStatus}
              </span>
            </div>

            {approvalStatus === "pending" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void decide("approved")}
                  disabled={decisionBusy}
                  className="rounded-xl"
                >
                  {decisionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Approve execution
                </Button>
                <Button
                  onClick={() => void decide("rejected")}
                  disabled={decisionBusy}
                  variant="outline"
                  className="rounded-xl"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {approvalStatus === "approved"
                  ? "Approved. Zero UI will claim the action and record each execution step."
                  : "No external execution is authorised for this action."}
              </div>
            )}
          </Card>

          {execution && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Action receipts</p>
                  <p className="text-xs text-muted-foreground">
                    Every runtime step reports its own outcome.
                  </p>
                </div>
                <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  {actionStatus}
                </span>
              </div>

              <div className="grid gap-2">
                {execution.receipts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No execution step has started yet.</p>
                ) : execution.receipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{receipt.step}</p>
                      <p className="text-xs text-muted-foreground">{receipt.provider}</p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase text-muted-foreground">{receipt.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
