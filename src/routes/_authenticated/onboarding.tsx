import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up — LeadMachine" },
      { name: "description", content: "Set up your business in three short steps." },
      { property: "og:title", content: "Set up — LeadMachine" },
      { property: "og:description", content: "Set up your business in three short steps." },
    ],
  }),
  component: Onboarding,
});

const INDUSTRIES = ["Plumbing", "Electrical", "Clinic", "Salon", "Building", "Cleaning", "Auto repair", "Other"];

function Onboarding() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [hours, setHours] = useState<WorkingHours>({ days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" });
  const [greeting, setGreeting] = useState("");
  const [services, setServices] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ws) return;
    setName(ws.profile.business_name);
    setIndustry(ws.profile.industry);
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
    const p = await supabase
      .from("business_profiles")
      .update({ business_name: name.trim(), industry, services, working_hours: hours, ...(finish ? { onboarded: true } : {}) })
      .eq("tenant_id", ws.tenantId);
    const pack = getVerticalPack(industry);
    const c = await supabase
      .from("auto_reply_configs")
      .update({
        greeting,
        questions: (pack?.questions ?? []).map((q) => q.question),
      })
      .eq("tenant_id", ws.tenantId);
    setSaving(false);
    if (p.error || c.error) {
      toast.error("Couldn't save. Try again.");
      return false;
    }
    await qc.invalidateQueries({ queryKey: ["workspace"] });
    if (finish) navigate({ to: "/dashboard" });
    return true;
  }

  const steps = ["Business", "Hours & greeting", "WhatsApp"];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <Logo />
      <div className="mt-10 flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Step {step + 1} of 3 · {steps[step]}</p>

      <div className="mt-8 flex-1">
        {step === 0 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">What's your business called?</h1>
            <div className="space-y-1.5">
              <Label htmlFor="bn">Business name</Label>
              <Input id="bn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mokoena Plumbing" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((i) => (
                  <button
                    key={i}
                    onClick={() => setIndustry(i)}
                    className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${industry === i ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              {(() => {
                const pack = getVerticalPack(industry);
                if (!pack) return null;
                return (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">{pack.label} Intelligence Pack ready</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Services and qualification questions are pre-filled. You can customise them later.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Services</p>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {pack.services.slice(0, 5).map((service) => <li key={service}>• {service}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Questions</p>
                        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                          {pack.questions.slice(0, 4).map((q) => <li key={q.id}>• {q.question}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-1.5">
                <Label htmlFor="services">Services covered by LeadMachine</Label>
                <Textarea
                  id="services"
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  rows={5}
                  className="rounded-xl"
                  placeholder="One service per line"
                />
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">When are you open?</h1>
            <HoursEditor value={hours} onChange={setHours} />
            <div className="space-y-1.5">
              <Label htmlFor="gr">Instant greeting</Label>
              <Textarea id="gr" rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} className="rounded-xl" />
              <p className="text-xs text-muted-foreground">Sent automatically to every new enquiry.</p>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Connect WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Link the number your customers message. You can do this later in Settings.</p>
            <WhatsAppConnect />
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" className="rounded-xl" onClick={() => setStep(step - 1)}>Back</Button>
        ) : <span />}
        {step < 2 ? (
          <Button
            className="h-11 rounded-xl px-6 font-semibold"
            disabled={saving || (step === 0 && !name.trim())}
            onClick={async () => { if (await save(false)) setStep(step + 1); }}
          >
            Continue
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => save(true)} disabled={saving}>I'll connect later</Button>
            <Button className="h-11 rounded-xl px-6 font-semibold" onClick={() => save(true)} disabled={saving}>Finish</Button>
          </div>
        )}
      </div>
    </div>
  );
}
