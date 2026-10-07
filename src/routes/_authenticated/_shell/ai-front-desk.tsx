import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, MessageCircle, Plus, ShieldCheck, Trash2, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { decideReplies, matchKeyword, type AutoReplyConfig, type KeywordRule, type WorkingHours } from "@/lib/autoreply";
import { getZeroUISettings, setZeroUISettings } from "@/lib/zero-ui.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/_shell/ai-front-desk")({
  head: () => ({
    meta: [
      { title: "AI Front Desk — RevenueDesk" },
      { name: "description", content: "Configure how RevenueDesk answers, qualifies and follows up with customers." },
    ],
  }),
  component: AIFontDeskPage,
});

function AIFontDeskPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const getSettings = useServerFn(getZeroUISettings);
  const setSettings = useServerFn(setZeroUISettings);
  const [cfg, setCfg] = useState<AutoReplyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testText, setTestText] = useState("");
  const [zero, setZero] = useState({ enabled: false, automationEnabled: true, autoFollowupsEnabled: true, whatsappConnected: false });

  useEffect(() => {
    if (ws) setCfg({ ...(ws.config as any), questions: (ws.config.questions as string[]) ?? [], keyword_rules: (ws.config.keyword_rules as KeywordRule[]) ?? [] });
  }, [ws]);

  useEffect(() => {
    if (!ws) return;
    getSettings()
      .then((value) => setZero({
        enabled: value.enabled,
        automationEnabled: value.automationEnabled,
        autoFollowupsEnabled: value.autoFollowupsEnabled,
        whatsappConnected: value.whatsappConnected,
      }))
      .catch(() => {});
  }, [ws, getSettings]);

  const hours = ws?.profile.working_hours as WorkingHours | undefined;

  const preview = useMemo(() => {
    if (!cfg || !hours) return [];
    const always: WorkingHours = { days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "24:00" };
    const flow: { from: "lead" | "bot"; text: string }[] = [];
    const leadLines = ["Hi, I need help with a job", ...cfg.questions.map((_, i) => ["It's a burst pipe", "I'm in Soweto", "Tomorrow morning works", "Yes"][i] ?? "Sure")];
    leadLines.forEach((line, i) => {
      flow.push({ from: "lead", text: line });
      decideReplies({ config: { ...cfg, keyword_rules: [] }, hours: always, inboundIndex: i + 1, text: line }).forEach((reply) => flow.push({ from: "bot", text: reply }));
    });
    return flow;
  }, [cfg, hours]);

  if (!cfg) return null;

  const set = (patch: Partial<AutoReplyConfig>) => {
    setCfg({ ...cfg, ...patch });
    setSaved(false);
  };

  async function save() {
    if (!ws || !cfg) return;
    setSaving(true);
    const { error } = await supabase.from("auto_reply_configs").update({
      enabled: cfg.enabled,
      greeting: cfg.greeting,
      questions: cfg.questions.filter((q) => q.trim()),
      keyword_rules: cfg.keyword_rules.map((r) => ({ ...r, keywords: r.keywords.map((k) => k.trim()).filter(Boolean) })),
      after_hours: cfg.after_hours,
      handoff: cfg.handoff,
      updated_at: new Date().toISOString(),
    }).eq("tenant_id", ws.tenantId);
    setSaving(false);
    if (error) {
      toast.error("Could not save");
      return;
    }
    setSaved(true);
    toast.success("AI Front Desk saved");
    qc.invalidateQueries({ queryKey: ["workspace"] });
  }

  async function toggle(field: "enabled" | "automationEnabled" | "autoFollowupsEnabled", value: boolean) {
    try {
      const patch = field === "enabled" ? { enabled: value } : field === "automationEnabled" ? { automationEnabled: value } : { autoFollowupsEnabled: value };
      const result = await setSettings({ data: patch });
      setZero((current) => ({ ...current, enabled: result.enabled, automationEnabled: result.automationEnabled, autoFollowupsEnabled: result.autoFollowupsEnabled }));
      toast.success("Front Desk updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the Front Desk");
    }
  }

  const testHit = testText.trim() ? matchKeyword(cfg.keyword_rules, testText) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="AI Front Desk"
        subtitle="Configure what RevenueDesk can handle before a human needs to step in."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <Card className="border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-background p-2.5 text-primary"><Bot className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Front Desk mode</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  RevenueDesk replies, qualifies and follows up using the rules and services you approve here.
                </p>
              </div>
              <Switch checked={zero.enabled} disabled={!zero.whatsappConnected} onCheckedChange={(v) => void toggle("enabled", v)} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <ToggleLine label="AI replies" on={zero.enabled} />
              <ToggleLine label="Automation" on={zero.automationEnabled} />
              <ToggleLine label="Follow-ups" on={zero.autoFollowupsEnabled} />
            </div>
            {!zero.whatsappConnected && <p className="mt-3 text-xs text-muted-foreground">Connect the business WhatsApp number before switching the Front Desk on.</p>}
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Qualification questions</p>
              <p className="mt-1 text-xs text-muted-foreground">Asked one at a time as the customer replies.</p>
            </div>
            {cfg.questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                <Input value={q} onChange={(e) => set({ questions: cfg.questions.map((x, j) => j === i ? e.target.value : x) })} className="h-10 rounded-xl" />
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => set({ questions: cfg.questions.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="secondary" className="rounded-xl" onClick={() => set({ questions: [...cfg.questions, ""] })} disabled={cfg.questions.length >= 5}><Plus className="mr-2 h-4 w-4" />Add question</Button>
          </Card>

          <Card className="space-y-4">
            <div>
              <Label htmlFor="greeting">First response</Label>
              <p className="mt-1 text-xs text-muted-foreground">The customer sees this immediately after the enquiry.</p>
            </div>
            <Textarea id="greeting" rows={4} value={cfg.greeting} onChange={(e) => set({ greeting: e.target.value })} className="rounded-xl" />
          </Card>

          <Card className="space-y-4">
            <div>
              <Label>After-hours response</Label>
              <p className="mt-1 text-xs text-muted-foreground">Collect enough context to keep the opportunity alive while the team is offline.</p>
            </div>
            <Textarea rows={3} value={cfg.after_hours} onChange={(e) => set({ after_hours: e.target.value })} className="rounded-xl" />
          </Card>

          <Card className="space-y-4">
            <div>
              <Label>Human handover</Label>
              <p className="mt-1 text-xs text-muted-foreground">Make the boundary clear when a person needs to take over.</p>
            </div>
            <Textarea rows={3} value={cfg.handoff} onChange={(e) => set({ handoff: e.target.value })} className="rounded-xl" />
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Approved keyword paths</p></div>
            <p className="text-xs text-muted-foreground">Use predictable paths for messages such as price, quote or address. Everything else can follow the AI qualification flow.</p>
            {cfg.keyword_rules.map((r, i) => {
              const upd = (patch: Partial<KeywordRule>) => set({ keyword_rules: cfg.keyword_rules.map((x, j) => j === i ? { ...x, ...patch } : x) });
              return (
                <div key={r.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={r.keywords.join(", ")} onChange={(e) => upd({ keywords: e.target.value.split(",") })} placeholder="price, quote, cost" className="h-10 rounded-xl" />
                    <Switch checked={r.enabled} onCheckedChange={(v) => upd({ enabled: v })} />
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => set({ keyword_rules: cfg.keyword_rules.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea rows={2} value={r.reply} onChange={(e) => upd({ reply: e.target.value })} placeholder="Approved reply" className="rounded-xl" />
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" className="rounded-xl" onClick={() => set({ keyword_rules: [...cfg.keyword_rules, { id: crypto.randomUUID(), keywords: [], reply: "", enabled: true }] })}><Plus className="mr-2 h-4 w-4" />Add path</Button>
              {cfg.keyword_rules.length > 0 && <><Input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Test a customer message" className="h-10 w-64 rounded-xl" />{testText.trim() && <span className="text-xs text-muted-foreground">{testHit ? "Matches an approved path" : "Normal AI flow"}</span>}</>}
            </div>
          </Card>

          <Button onClick={save} disabled={saving} className="h-11 rounded-xl px-5 font-semibold">
            {saved ? <><Check className="mr-2 h-4 w-4" />Saved</> : saving ? "Saving…" : "Save Front Desk"}
          </Button>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Customer preview</p></div>
              <p className="mt-1 text-xs text-muted-foreground">A realistic preview of the current first-response flow.</p>
            </div>
            <div className="space-y-2 p-4">
              {preview.map((m, i) => (
                <div key={i} className={`flex ${m.from === "bot" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${m.from === "bot" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-secondary-foreground"}`}>{m.text}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Safe control</p></div>
            <p className="text-xs leading-5 text-muted-foreground">Automation can be paused without disconnecting WhatsApp. Keep human handover available for judgement-heavy conversations.</p>
            <div className="flex items-center gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-primary" /> WhatsApp {zero.whatsappConnected ? "connected" : "not connected"}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleLine({ label, on }: { label: string; on: boolean }) {
  return <div className="rounded-xl border border-border bg-background px-3 py-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-0.5 text-sm font-semibold ${on ? "text-primary" : ""}`}>{on ? "On" : "Off"}</p></div>;
}
