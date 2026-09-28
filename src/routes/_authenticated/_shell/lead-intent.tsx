import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { analyzeConversation } from "@/lib/ai.functions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui-bits";
import { TemperatureBadge } from "@/components/TemperatureBadge";

export const Route = createFileRoute("/_authenticated/_shell/lead-intent")({
  head: () => ({
    meta: [
      { title: "Lead Intent — LeadCatch SA" },
      { name: "description", content: "Paste a WhatsApp chat and get an AI hot/warm/cold score with next steps." },
      { property: "og:title", content: "Lead Intent — LeadCatch SA" },
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

  async function run() {
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await analyze({ data: { conversation: text } })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not analyse this chat."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
      <PageHeader title="Lead Intent" subtitle="Paste a WhatsApp conversation to see how ready the customer is to buy." />
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
          <Button onClick={run} disabled={busy || text.trim().length < 10} className="rounded-xl">
            <Sparkles className="mr-2 h-4 w-4" />{busy ? "Analysing…" : "Analyse"}
          </Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </Card>
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
    </div>
  );
}
