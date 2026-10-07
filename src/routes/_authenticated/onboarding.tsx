import type { ComponentType } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, Clock3, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";
import { HoursEditor } from "@/components/HoursEditor";
import type { WorkingHours } from "@/lib/autoreply";
import { getVerticalPack } from "@/lib/vertical-packs";
import { getZeroUISettings, setZeroUISettings } from "@/lib/zero-ui.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your Revenue Desk — Lead Machine" },
      { name: "description", content: "Set up your business, AI Front Desk and WhatsApp connection." },
    ],
  }),
  component: Onboarding,
});

const INDUSTRIES = ["Plumbing", "Electrical", "Clinic", "Salon", "Building", "Cleaning", "Auto repair", "Other"];

function Onboarding() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setZero = useServerFn(setZeroUISettings);
  const getZero = useServerFn(getZeroUISettings);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [suburb, setSuburb] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [hours, setHours] = useState<WorkingHours>({ days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" });
  const [greeting, setGreeting] = useState("");
  const [services, setServices] = useState("");
  const [frontDesk, setFrontDesk] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ws) return;
    setName(ws.profile.business_name);
    setIndustry(ws.profile.industry);
    setSuburb(ws.profile.suburb ?? "");
    setAlertPhone(ws.profile.contact_phone ?? "");
    setHours(ws.profile.working_hours as WorkingHours);
    setGreeting(ws.config.greeting);
    setServices(ws.profile.services ?? "");
  }, [ws]);

  useEffect(() => {
    const pack = getVerticalPack(industry);
    if (!pack) return;
    setServices(pack.services.join("\n"));
    setGreeting((current) => current || `Hi! Thanks for contacting ${name || "us"}. We’ll help you right away.`);
  }, [industry, name]);

  async function save(finish: boolean) {
    if (!ws) return;
    setSaving(true);

    const profileResult = await supabase.from("business_profiles").update({
      business_name: name.trim(),
      industry,
      suburb: suburb.trim(),
      contact_phone: alertPhone.trim(),
      services,
      working_hours: hours,
      ...(finish ? { onboarded: true } : {}),
    }).eq("tenant_id", ws.tenantId);

    const pack = getVerticalPack(industry);
    const configResult = await supabase.from("auto_reply_configs").update({
      greeting,
      questions: (pack?.questions ?? []).map((q) => q.question),
    }).eq("tenant_id", ws.tenantId);

    if (frontDesk && finish) {
      try {
        const current = await getZero();
        if (current.whatsappConnected) {
          await setZero({ data: { enabled: true, automationEnabled: true, autoFollowupsEnabled: true } });
        }
      } catch {
        // Connecting WhatsApp can happen after onboarding; setup still completes safely.
      }
    }

    setSaving(false);
    if (profileResult.error || configResult.error) {
      toast.error("Couldn’t save your setup. Try again.");
      return false;
    }

    await qc.invalidateQueries({ queryKey: ["workspace"] });
    if (finish) navigate({ to: "/dashboard" });
    return true;
  }

  const steps = ["Business", "AI Front Desk", "WhatsApp"];

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-8">
        <Logo />
        <div className="mt-10 flex gap-2">
          {steps.map((item, i) => (
            <div key={item} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Step {step + 1} of 3 · {steps[step]}</p>

        <div className="mt-8 flex-1">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start with the business</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tell Lead Machine what it is protecting.</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">This becomes the context your AI Front Desk uses when handling customer enquiries.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bn">Business name</Label>
                <Input id="bn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mokoena Plumbing" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((item) => (
                    <button
                      key={item}
                      onClick={() => setIndustry(item)}
                      className={`rounded-xl border px-3.5 py-2 text-sm ${industry === item ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suburb">Main service area</Label>
                <Input id="suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="e.g. Sandton, Randburg, Fourways" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="services">Services</Label>
                <Textarea id="services" value={services} onChange={(e) => setServices(e.target.value)} rows={5} placeholder="One service per line" className="rounded-xl" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Set the boundary</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">How should your AI Front Desk behave?</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Start safe. Lead Machine can handle first response and qualification, while you keep control over what gets sent.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <ModeCard icon={MessageCircle} title="First response" text="Reply immediately to new enquiries." />
                <ModeCard icon={Sparkles} title="Qualification" text="Ask for service, area and urgency." />
                <ModeCard icon={ShieldCheck} title="Human handover" text="Escalate when judgement is needed." />
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">Enable Front Desk after setup</p>
                    <p className="mt-1 text-xs text-muted-foreground">It will only switch on automatically when the business WhatsApp is connected.</p>
                  </div>
                  <button onClick={() => setFrontDesk(!frontDesk)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${frontDesk ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    {frontDesk ? "On" : "Off"}
                  </button>
                </div>
              </div>
              <div>
                <Label>Working hours</Label>
                <div className="mt-2"><HoursEditor value={hours} onChange={setHours} /></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gr">First response</Label>
                <Textarea id="gr" rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} className="rounded-xl" />
                <p className="text-xs text-muted-foreground">Keep it human. The AI will use it as the opening message.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-4 w-4 text-primary" /> Qualification questions are pre-filled from the selected industry.
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Connect the channel</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">Put Lead Machine behind the WhatsApp number customers already use.</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Connect now or do it later. Your Revenue Desk is ready either way.</p>
              </div>
              <WhatsAppConnect />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-4"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-3 font-medium">After hours</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Collect the job details even when the team is offline.</p></div>
                <div className="rounded-2xl border border-border bg-card p-4"><ShieldCheck className="h-4 w-4 text-primary" /><p className="mt-3 font-medium">Human control</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Turn automation down or off from the Front Desk screen.</p></div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" className="rounded-xl" onClick={() => setStep(step - 1)}>Back</Button>
          ) : <span />}

          {step < 2 ? (
            <Button
              className="h-11 rounded-xl px-6"
              disabled={saving || (step === 0 && !name.trim())}
              onClick={async () => { if (await save(false)) setStep(step + 1); }}
            >
              Continue
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-xl" onClick={() => void save(true)} disabled={saving}>Finish later</Button>
              <Button className="h-11 rounded-xl px-6" onClick={() => void save(true)} disabled={saving}>
                {saving ? "Setting up…" : <><Check className="mr-2 h-4 w-4" />Launch Revenue Desk</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeCard({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
