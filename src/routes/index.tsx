import { useState } from "react";
import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCheck,
  Clock3,
  DollarSign,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { getIndustryExperience, INDUSTRY_EXPERIENCES } from "@/lib/industry-experiences";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevenueDesk — The AI Revenue Desk for service businesses" },
      {
        name: "description",
        content:
          "Capture enquiries, qualify leads, recover missed opportunities and keep follow-up moving with an AI Revenue Desk built for South African service businesses.",
      },
      { property: "og:title", content: "RevenueDesk — The AI Revenue Desk for service businesses" },
      {
        property: "og:description",
        content:
          "Capture enquiries, qualify leads, recover missed opportunities and keep follow-up moving.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [industryId, setIndustryId] = useState("plumber");
  const experience = getIndustryExperience(industryId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#leaks" className="hover:text-foreground">Revenue leaks</a>
            <a href="#front-desk" className="hover:text-foreground">AI Front Desk</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Link to="/auth" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {experience ? "Built specifically for " + experience.label.toLowerCase() : "Built for South African service businesses"}
            </div>
            <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-7xl">
              {experience?.headline ?? "The AI Revenue Desk for service businesses."}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
{experience?.subheadline ?? "Every enquiry captured. Every lead understood. Every follow-up handled. RevenueDesk gives the front of your business an intelligent system behind it."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 font-medium hover:bg-accent">
                See how it works
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCheck className="h-3.5 w-3.5 text-primary" /> 14-day trial</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> POPIA-aware capture</span>
              <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-primary" /> WhatsApp-first</span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-3 shadow-sm">
            <div className="rounded-[1.6rem] border border-border bg-background p-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{experience?.deskName ?? "Revenue Desk"}</p>
                  <p className="mt-1 text-lg font-semibold">What needs attention now</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Live</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <MiniMetric label="New enquiries" value="18" />
                <MiniMetric label="Hot waiting" value="4" />
                <MiniMetric label="Leak alerts" value="7" />
              </div>

              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-background p-2 text-primary shadow-sm"><DollarSign className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold">{experience?.label ?? "Service"} enquiries need a response</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {experience?.outcome ?? "RevenueDesk has already captured the suburb, service and urgency. Work the queue first."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="font-medium">Priority queue</span>
                  <span className="text-primary">4 leads</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  ["Sipho M.", "Burst geyser · Bryanston", "10/10"],
                  ["Naledi P.", "DB board fault · Sandton", "9/10"],
                  ["Johan V.", "Bakkie won't start · Midrand", "9/10"],
                ].map(([name, detail, score]) => (
                  <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{detail}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-primary">{score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Choose your industry</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">RevenueDesk should sound like your business, not a generic CRM.</h2>
              <p className="mt-3 text-muted-foreground">Pick a business type and see the front desk, questions and revenue leaks RevenueDesk is designed around.</p>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              {INDUSTRY_EXPERIENCES.slice(0, 20).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndustryId(item.id)}
                  className={industryId === item.id ? "rounded-full border border-primary bg-primary/10 px-3.5 py-2 text-xs font-semibold" : "rounded-full border border-border bg-background px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {experience && (
              <div className="mt-7 grid gap-4 md:grid-cols-[1fr_0.8fr]">
                <div className="rounded-3xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{experience.label} RevenueDesk</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{experience.headline}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{experience.problem}</p>
                </div>
                <div className="rounded-3xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Built-in qualification</p>
                  <div className="mt-3 space-y-2">
                    {experience.qualificationQuestions.slice(0, 3).map((question, index) => (
                      <div key={question} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                        <span>{question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The problem</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Your business can have enough enquiries and still lose the work.
              </h2>
              <p className="mt-4 text-muted-foreground">
                A missed call, a WhatsApp message after hours, a quote nobody followed up and a hot lead sitting untouched all look small. Together, they become a revenue problem.
              </p>
            </div>
            <div id="leaks" className="mt-10 grid gap-4 md:grid-cols-4">
              <LeakCard icon={PhoneCall} title="Missed calls" text="Turn a missed call into a live conversation instead of a lost job." />
              <LeakCard icon={Clock3} title="Slow response" text="See hot enquiries that are waiting too long for a human response." />
              <LeakCard icon={Sparkles} title="Cold quotes" text="Surface leads that showed intent but never moved to the next step." />
              <LeakCard icon={Zap} title="After hours" text="Capture the job details now and keep the conversation moving." />
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 md:grid-cols-[0.7fr_1.3fr] md:items-start">
            <div className="md:sticky md:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">How RevenueDesk works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Capture → Understand → Act → Recover → Measure → Learn.
              </h2>
              <p className="mt-4 text-muted-foreground">
                The owner sees one operating picture. The customer still gets the channel they already use.
              </p>
            </div>
            <div className="space-y-3">
              {[
                ["01", "Capture", "Bring WhatsApp, website, forms, QR and future channels into one enquiry flow.", MessageCircle],
                ["02", "Understand", "AI identifies service, urgency, fit, intent and the next best action.", Sparkles],
                ["03", "Act", "Reply, qualify, route, quote, book or hand over to a human.", Bot],
                ["04", "Recover", "Find missed, unanswered, hot, stalled and forgotten opportunities.", Zap],
                ["05", "Measure", "See response time, pipeline movement, leak alerts and conversion signals.", BarChart3],
                ["06", "Learn", "Use recurring customer demand and competitor signals to find the next opportunity.", DollarSign],
              ].map(([num, title, text, Icon]) => (
                <div key={String(num)} className="grid gap-4 rounded-2xl border border-border p-5 sm:grid-cols-[48px_180px_1fr] sm:items-start">
                  <span className="text-xs font-semibold text-muted-foreground">{num}</span>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="font-semibold">{String(title)}</p>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{String(text)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="front-desk" className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1fr_0.9fr] md:items-center">
            <div className="rounded-[2rem] border border-border bg-background p-5">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Bot className="h-5 w-5" /></div>
                  <div>
                    <p className="text-sm font-semibold">AI Front Desk</p>
                    <p className="text-xs text-muted-foreground">Assist → qualify → follow up → hand over</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <ChatRow from="Customer" text="Hi, my geyser burst and I'm in Fourways. Can you come today?" />
                  <ChatRow from="RevenueDesk" text="Yes, we can help. Is the water still running, and what time would suit you today?" />
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                    <span className="font-semibold text-primary">Lead signal</span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Signal label="Intent" value="High" />
                      <Signal label="Urgency" value="Today" />
                      <Signal label="Area" value="Fourways" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI Front Desk</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Your business keeps replying while you're doing the actual work.
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                RevenueDesk can handle first response, qualification and eligible follow-up while keeping a human in control of sensitive or high-value conversations.
              </p>
              <div className="mt-7 space-y-3 text-sm">
                <FeatureLine text="Uses your services and approved business information" />
                <FeatureLine text="Escalates when a human needs to take over" />
                <FeatureLine text="Works from the same conversation history your team sees" />
                <FeatureLine text="Can be controlled from WhatsApp through Zero UI" />
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pricing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Start with the revenue problem, not the feature list.</h2>
            <p className="mt-4 text-muted-foreground">These are the redesigned packaging levels. We can validate the exact willingness-to-pay with the first 10–20 customers.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <PriceCard name="Starter" price="R997" description="Capture and organise enquiries." items={["WhatsApp inbox", "Instant replies", "Lead capture", "Business page"]} />
            <PriceCard name="Growth" price="R1,997" featured description="The AI front desk." items={["Everything in Starter", "AI qualification", "AI reply drafts", "Follow-up workflows"]} />
            <PriceCard name="Pro" price="R3,997" description="Revenue recovery and intelligence." items={["Everything in Growth", "Revenue leak detection", "Advanced automation", "Market Intelligence"]} />
            <PriceCard name="Managed" price="Custom" description="NahaLabs operates the system with you." items={["Setup and optimisation", "Custom workflows", "Integrations", "Ongoing support"]} />
          </div>
        </section>

        <section className="border-t border-border bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-3xl font-semibold tracking-tight md:text-4xl">Stop guessing where the jobs are going.</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/80">See the work, the waiting leads and the leaks in one place.</p>
            </div>
            <Link to="/auth" className="inline-flex items-center justify-center gap-2 rounded-xl bg-background px-5 py-3 font-semibold text-foreground">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function LeakCard({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function ChatRow({ from, text }: { from: string; text: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{from}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

function FeatureLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{text}</span>
    </div>
  );
}

function PriceCard({
  name,
  price,
  description,
  items,
  featured = false,
}: {
  name: string;
  price: string;
  description: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <div className={`rounded-3xl border bg-card p-6 ${featured ? "border-primary shadow-soft" : "border-border"}`}>
      {featured && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">Most popular</span>}
      <p className="mt-4 font-semibold">{name}</p>
      <p className="mt-3 text-3xl font-semibold">{price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
      <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-2 text-sm">
        {items.map((item) => <div key={item} className="flex gap-2"><CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</div>)}
      </div>
      <Link to="/auth" className={`mt-6 block rounded-xl py-2.5 text-center text-sm font-semibold ${featured ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-accent"}`}>Start free</Link>
    </div>
  );
}
