import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, PenLine, Copy } from "lucide-react";
import { toast } from "sonner";
import { analyzeConversation, draftReply } from "@/lib/ai.functions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui-bits";
import { TemperatureBadge } from "@/components/TemperatureBadge";
import { FollowUpWriter } from "@/components/FollowUpWriter";
import { AgentWorkforcePanel } from "@/components/agent-workforce/AgentWorkforcePanel";

export const Route = createFileRoute("/_authenticated/_shell/lead-intent")({
  head: () => ({
    meta: [
      { title: "Lead Intent — LeadMachine" },
      { name: "description", content: "Paste a WhatsApp chat and get an AI hot/warm/cold score with next steps." },
      { property: "og:title", content: "Lead Intent — LeadMachine" },
      { property: "og:description", content: "Paste a WhatsApp chat and get an AI hot/warm/cold score with next steps." },
    ],
  }),
  component: LeadIntentPage,
});

type Result = { score: number; temperature: "hot" | "warm" | "cold"; intent: string; summary: string; followUp: string[] };

function LeadIntentPage() {
  const analyze = useServerFn(analyzeConversation);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const draft = useServerFn(draftReply);
  const [drafting, setDrafting] = useState(false);
  const [reply, setReply] = useState<{ reply: string; reasoning: string; temperature: string; score: number } | null>(null);

  async function runDraft() {
    setDrafting(true); setErr(null); setReply(null);
    try { setReply(await draft({ data: { conversation: text } })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not draft a reply."); }
    finally { setDrafting(false); }
  }

  async function run() {
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await analyze({ data: { conversation: text } })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not analyse this chat."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-8"><AgentWorkforcePanel /><div className="border-t border-border pt-6">
      <PageHeader title="Lead Intent" subtitle="Paste a WhatsApp conversation to score how ready the customer is to buy, or draft a personal reply." />
      <Card className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          maxLength={12000}
          placeholder={"Customer: Hi, my geyser burst, can someone come today?\nYou: Yes, which suburb are you in?"}
          className="rounded-xl"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{text.length}/12000</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runDraft} disabled={drafting || text.trim().length < 10} className="rounded-xl">
              <PenLine className="mr-2 h-4 w-4" />{drafting ? "Writing…" : "Draft reply"}
            </Button>
            <Button onClick={run} disabled={busy || text.trim().length < 10} className="rounded-xl">
              <Sparkles className="mr-2 h-4 w-4" />{busy ? "Analysing…" : "Analyse"}
            </Button>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </Card>
      {reply && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Suggested reply</p>
            <TemperatureBadge temperature={reply.temperature} />
          </div>
          <p className="whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">{reply.reply}</p>
          {reply.reasoning && <p className="text-xs text-muted-foreground">{reply.reasoning}</p>}
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(reply.reply); toast.success("Copied"); }}>
            <Copy className="mr-2 h-4 w-4" />Copy reply
          </Button>
        </Card>
      )}
      <FollowUpWriter />
      {res && (
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold">{res.score}/10</span>
            <TemperatureBadge temperature={res.temperature} />
          </div>
          {res.intent && <p className="text-sm"><span className="font-medium">Intent: </span>{res.intent}</p>}
          {res.summary && <p className="text-sm text-muted-foreground">{res.summary}</p>}
          {res.followUp.length > 0 && (
            <div>
              <p className="text-sm font-medium">Recommended follow-up</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {res.followUp.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div></div>
  );
}
