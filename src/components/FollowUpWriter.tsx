import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { draftFollowUp } from "@/lib/ai.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui-bits";
import { TemperatureBadge } from "@/components/TemperatureBadge";

export function FollowUpWriter() {
  const run = useServerFn(draftFollowUp);
  const [f, setF] = useState({ leadName: "", service: "", lastContact: "", goal: "", context: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<{ message: string; temperature: string; reasoning: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function go() {
    setBusy(true); setErr(null); setOut(null);
    try { setOut(await run({ data: f })); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not write a follow-up."); }
    finally { setBusy(false); }
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-medium">Follow-up writer</p>
        <p className="text-sm text-muted-foreground">Enter a lead's details and what happened so far. Get a personal WhatsApp follow-up to send.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Lead name *" maxLength={80} value={f.leadName} onChange={set("leadName")} className="rounded-xl" />
        <Input placeholder="Service they want (e.g. geyser replacement)" maxLength={200} value={f.service} onChange={set("service")} className="rounded-xl" />
        <Input placeholder="Last contact (e.g. 3 days ago)" maxLength={80} value={f.lastContact} onChange={set("lastContact")} className="rounded-xl" />
        <Input placeholder="Goal (e.g. book a site visit)" maxLength={200} value={f.goal} onChange={set("goal")} className="rounded-xl" />
      </div>
      <Textarea rows={5} maxLength={6000} value={f.context} onChange={set("context")} className="rounded-xl"
        placeholder="What was said so far? e.g. Asked for a quote on Monday, I sent R4,500, no reply since." />
      <div className="flex justify-end">
        <Button onClick={go} disabled={busy || !f.leadName.trim() || f.context.trim().length < 5} className="rounded-xl">
          <Send className="mr-2 h-4 w-4" />{busy ? "Writing…" : "Write follow-up"}
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {out && (
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Suggested follow-up</p><TemperatureBadge temperature={out.temperature} /></div>
          <p className="whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">{out.message}</p>
          {out.reasoning && <p className="text-xs text-muted-foreground">{out.reasoning}</p>}
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(out.message); toast.success("Copied"); }}>
            <Copy className="mr-2 h-4 w-4" />Copy message
          </Button>
        </div>
      )}
    </Card>
  );
}
