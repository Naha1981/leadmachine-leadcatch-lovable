import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { decideReplies, matchKeyword, type AutoReplyConfig, type KeywordRule, type WorkingHours } from "@/lib/autoreply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/_shell/auto-reply")({
  head: () => ({
    meta: [
      { title: "Auto-Reply — LeadCatch SA" },
      { name: "description", content: "Set your instant greeting, qualification questions, keyword replies and after-hours message." },
      { property: "og:title", content: "Auto-Reply — LeadCatch SA" },
      { property: "og:description", content: "Configure instant WhatsApp replies." },
    ],
  }),
  component: AutoReplyPage,
});

function AutoReplyPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<AutoReplyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testText, setTestText] = useState("");

  useEffect(() => {
    if (ws) setCfg({ ...(ws.config as any), questions: (ws.config.questions as string[]) ?? [], keyword_rules: (ws.config.keyword_rules as KeywordRule[]) ?? [] });
  }, [ws]);

  const hours = ws?.profile.working_hours as WorkingHours | undefined;

  const preview = useMemo(() => {
    if (!cfg || !hours) return [];
    const always: WorkingHours = { days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "24:00" };
    const flow: { from: "lead" | "bot"; text: string; tag?: string }[] = [];
    const leadLines = ["Hi, I need help with a job", ...cfg.questions.map((_, i) => ["It's a burst pipe", "I'm in Soweto", "Tomorrow morning works", "Yes"][i] ?? "Sure")];
    leadLines.forEach((l, i) => {
      flow.push({ from: "lead", text: l });
      decideReplies({ config: { ...cfg, keyword_rules: [] }, hours: always, inboundIndex: i + 1, text: l }).forEach((t) => flow.push({ from: "bot", text: t }));
    });
    return flow;
  }, [cfg, hours]);

  if (!cfg) return null;
  const set = (patch: Partial<AutoReplyConfig>) => { setCfg({ ...cfg, ...patch }); setSaved(false); };
  const testHit = testText.trim() ? matchKeyword(cfg.keyword_rules, testText) : null;

  async function save() {
    if (!ws || !cfg) return;
    setSaving(true);
    const { error } = await supabase
      .from("auto_reply_configs")
      .update({
        enabled: cfg.enabled,
        greeting: cfg.greeting,
        questions: cfg.questions.filter((q) => q.trim()),
        keyword_rules: cfg.keyword_rules.map((r) => ({ ...r, keywords: r.keywords.map((k) => k.trim()).filter(Boolean) })),
        after_hours: cfg.after_hours,
        handoff: cfg.handoff,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ws.tenantId);
    setSaving(false);
    if (error) { toast.error("Could not save"); return; }
    setSaved(true);
    toast.success("Auto-reply saved");
    qc.invalidateQueries({ queryKey: ["workspace"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Auto-Reply"
        subtitle="What customers receive the moment they message you."
        action={
          <Button onClick={save} disabled={saving} className="h-11 rounded-xl px-5 font-semibold">
            {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : "Save"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Auto-replies {cfg.enabled ? "on" : "off"}</p>
              <p className="text-sm text-muted-foreground">Turn off to reply to everything yourself.</p>
            </div>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => set({ enabled: v })} aria-label="Enable auto-replies" />
          </Card>

          <Card className="space-y-2">
            <Label htmlFor="greet">Instant greeting</Label>
            <Textarea id="greet" rows={3} value={cfg.greeting} onChange={(e) => set({ greeting: e.target.value })} className="rounded-xl" />
          </Card>

          <Card className="space-y-3">
            <div>
              <Label>Qualification questions</Label>
              <p className="mt-1 text-xs text-muted-foreground">Asked one at a time, after each customer reply.</p>
            </div>
            {cfg.questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                <Input value={q} onChange={(e) => set({ questions: cfg.questions.map((x, j) => (j === i ? e.target.value : x)) })} className="h-10 rounded-xl" />
                <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Remove question" onClick={() => set({ questions: cfg.questions.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" className="rounded-xl" onClick={() => set({ questions: [...cfg.questions, ""] })} disabled={cfg.questions.length >= 5}>
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </Card>

          <Card className="space-y-3">
            <div>
              <Label>Keyword replies</Label>
              <p className="mt-1 text-xs text-muted-foreground">If a message contains any keyword, this reply is sent instead. Separate keywords with commas.</p>
            </div>
            {cfg.keyword_rules.map((r, i) => {
              const upd = (p: Partial<KeywordRule>) => set({ keyword_rules: cfg.keyword_rules.map((x, j) => (j === i ? { ...x, ...p } : x)) });
              return (
                <div key={r.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={r.keywords.join(", ")} onChange={(e) => upd({ keywords: e.target.value.split(",") })} placeholder="price, quote, cost" className="h-10 rounded-xl" />
                    <Switch checked={r.enabled} onCheckedChange={(v) => upd({ enabled: v })} aria-label="Enable rule" />
                    <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Remove rule" onClick={() => set({ keyword_rules: cfg.keyword_rules.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea rows={2} value={r.reply} onChange={(e) => upd({ reply: e.target.value })} placeholder="Reply to send" className="rounded-xl" />
                </div>
              );
            })}
            <Button
              variant="secondary"
              className="rounded-xl"
              onClick={() => set({ keyword_rules: [...cfg.keyword_rules, { id: crypto.randomUUID(), keywords: [], reply: "", enabled: true }] })}
            >
              <Plus className="h-4 w-4" /> Add keyword reply
            </Button>
            {cfg.keyword_rules.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="test" className="text-xs text-muted-foreground">Test a message</Label>
                <Input id="test" value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="How much for a geyser?" className="h-10 rounded-xl" />
                {testText.trim() && (
                  <p className="text-xs">{testHit ? <span className="text-primary">Matches → “{testHit.reply}”</span> : <span className="text-muted-foreground">No keyword match — normal flow applies.</span>}</p>
                )}
              </div>
            )}
          </Card>

          <Card className="space-y-2">
            <Label htmlFor="ah">After-hours message</Label>
            <Textarea id="ah" rows={2} value={cfg.after_hours} onChange={(e) => set({ after_hours: e.target.value })} className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Sent to new enquiries outside your working hours.</p>
          </Card>

          <Card className="space-y-2">
            <Label htmlFor="ho">Handoff message</Label>
            <Textarea id="ho" rows={2} value={cfg.handoff} onChange={(e) => set({ handoff: e.target.value })} className="rounded-xl" />
            <p className="text-xs text-muted-foreground">Sent after the last question is answered.</p>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Preview</p>
          <div className="rounded-3xl border border-border bg-sidebar p-4">
            {!cfg.enabled ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Auto-replies are off.</p>
            ) : (
              <div className="space-y-2">
                {preview.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "bot" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.from === "bot" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-secondary-foreground"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
