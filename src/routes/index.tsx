import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Bot,
  Car,
  CheckCheck,
  Clock,
  Clock3,
  Gauge,
  Globe,
  Inbox,
  LayoutDashboard,
  MapPin,
  MapPinned,
  MessageCircle,
  Phone,
  QrCode,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { TemperatureBadge } from "@/components/TemperatureBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadMachine — Turn WhatsApp enquiries into paying customers" },
      {
        name: "description",
        content:
          "Instant WhatsApp auto-replies, AI lead scoring and one inbox for South African service businesses.",
      },
      { property: "og:title", content: "LeadMachine — Never lose a WhatsApp lead again" },
      {
        property: "og:description",
        content:
          "Instant WhatsApp auto-replies, AI lead scoring and one inbox for South African service businesses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#problem" className="transition-colors hover:text-foreground">
              Why
            </a>
            <a href="#demand-radar" className="transition-colors hover:text-foreground">
              Demand Radar
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              to="/auth"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 md:grid-cols-[0.92fr_1.08fr] md:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Built for South African trades
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
            Turn WhatsApp enquiries into paying customers{" "}
            <span className="text-primary">in seconds.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            LeadMachine replies to every lead instantly, asks the right questions, scores buying
            intent and gives you one clean inbox — even while you're on the job.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Start 14-day free trial
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-border bg-card px-5 py-3 font-medium shadow-sm transition-colors hover:bg-accent"
            >
              See how it works
            </a>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
              No card needed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              POPIA South Africa compliant
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-primary" />
              Set up in 5 minutes
            </span>
          </div>
        </div>
        <HeroStory />
      </section>

      {/* Before / after */}
      <section id="problem" className="border-y border-border bg-card/45">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Before vs after
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              The job does not stop just because you're under a sink.
            </h2>
            <p className="mt-3 text-muted-foreground">
              LeadMachine handles the first response while you keep working, then turns the chaos
              into a prioritized queue you can actually close.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <StoryCard
              eyebrow="11:30 AM · Hands on the job"
              title="Missed message while you're under a vehicle"
              tone="muted"
              icon={Car}
            >
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" /> 11:34 · WhatsApp
                </div>
                <p className="mt-3 text-sm font-medium">
                  “Hi, my bakkie won't start. Can you come to Randburg?”
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-destructive">
                  <X className="h-4 w-4" /> 3 hours later — competitor already booked it
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
                <span>Manual reply</span>
                <span className="font-medium">Too late</span>
              </div>
            </StoryCard>

            <StoryCard
              eyebrow="11:31 AM · LeadMachine is working"
              title="Instant qualification while you stay on the job"
              tone="primary"
              icon={Wrench}
            >
              <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-primary" /> Auto-reply
                  </span>
                  <span className="text-primary">2.4 sec</span>
                </div>
                <p className="mt-3 rounded-xl rounded-bl-md bg-muted px-3 py-2 text-sm">
                  “Yes — we can help. What make is the vehicle, and which suburb are you in?”
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <MiniStat label="Suburb" value="Randburg" />
                  <MiniStat label="Urgency" value="Today" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-xs">
                <span className="font-medium text-primary">Lead captured + qualified</span>
                <span className="font-semibold text-primary">9/10 Hot</span>
              </div>
            </StoryCard>
          </div>
        </div>
      </section>

      {/* Demand Radar */}
      <section id="demand-radar" className="border-y border-border bg-card/45">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Pillar 01 · Proactive lead capture
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold text-primary">
                <Radio className="h-3 w-3" /> Live social signal
              </span>
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Someone just asked for your service. LeadMachine found the post.
            </h2>
            <p className="mt-3 text-muted-foreground">
              LeadMachine monitors public Reddit community conversations for service demand, matches the signal to your business and alerts you with the exact post while the customer is still looking.
            </p>
          </div>
          <DemandRadarPreview />
        </div>
      </section>

      {/* Day in life */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 md:grid-cols-[0.7fr_1.3fr] md:items-start">
          <div className="md:sticky md:top-24">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              A contractor's day
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Your business keeps replying, even when you cannot.
            </h2>
            <p className="mt-4 text-muted-foreground">
              One system handles the first touch, qualification and prioritisation. You spend your
              time on the work and the hot jobs.
            </p>
          </div>
          <div className="space-y-4">
            <LifeCard
              time="11:30 AM"
              title="Hands on the job"
              body="A customer messages while you're fixing a DB board. LeadMachine asks what service they need, their suburb and how urgent it is."
              icon={Wrench}
              stat="Lead captured"
            />
            <LifeCard
              time="08:45 PM"
              title="After hours"
              body="A homeowner asks whether you can handle a weekend geyser emergency. The system gives your after-hours response and collects the details for tomorrow."
              icon={Clock3}
              stat="Reply in 2.4 sec"
            />
            <LifeCard
              time="09:00 AM"
              title="Monday morning"
              body="Open one clean inbox. Your hottest enquiries are already scored, summarised and ready for a call, quote or follow-up."
              icon={LayoutDashboard}
              stat="10/10 → call first"
            />
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-y border-border bg-card/45">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              How it works
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              From WhatsApp message to qualified lead.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Keep the same customer channel. LeadMachine adds the system behind it.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                i: QrCode,
                t: "Connect the number",
                d: "Link your existing WhatsApp number with a simple QR flow.",
              },
              {
                i: MessageCircle,
                t: "Set the questions",
                d: "Service, suburb, urgency and any qualification fields your team needs.",
              },
              {
                i: Gauge,
                t: "Close the hot ones",
                d: "See who is ready to buy, call back or send a quote link from one inbox.",
              },
            ].map((s, n) => (
              <div key={s.t} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <s.i className="h-5 w-5" />
                  </span>
                  <span className="text-xs text-muted-foreground">Step {n + 1}</span>
                </div>
                <p className="mt-4 font-semibold">{s.t}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature bento */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Product stories
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Show customers what LeadMachine actually does.
          </h2>
          <p className="mt-3 text-muted-foreground">
            The product is visual: capture the lead, understand the intent, and make the next move.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-12">
          <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm md:col-span-7">
            <div className="flex items-start justify-between gap-4">
              <Feature icon={Gauge} title="AI lead scoring" text="Hot, Warm or Cold — with a reason, not just a number." />
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                Live signal
              </span>
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Geyser emergency</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sipho M. · Bryanston</p>
                </div>
                <TemperatureBadge temperature="hot" />
              </div>
              <div className="mt-5 flex items-end gap-4">
                <div>
                  <p className="text-4xl font-semibold tracking-tight">10<span className="text-base text-muted-foreground">/10</span></p>
                  <p className="mt-1 text-xs font-medium text-primary">Ready to book</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 w-full rounded-full bg-primary" />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>Cold</span><span>Warm</span><span>Hot</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5">
                <span className="font-semibold text-primary">Why:</span> burst geyser + immediate availability request + suburb captured.
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm md:col-span-5">
            <Feature icon={QrCode} title="WhatsApp QR connection" text="A simple handoff from your existing number into the LeadMachine workflow." />
            <div className="mt-5 rounded-2xl border border-border bg-background p-5">
              <div className="mx-auto w-28 rounded-xl border border-border bg-card p-2 shadow-sm">
                <div className="grid grid-cols-5 gap-1 p-1">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <span
                      key={i}
                      className={`aspect-square rounded-[2px] ${[0, 1, 4, 5, 9, 10, 12, 14, 15, 19, 20, 21, 24].includes(i) ? "bg-foreground" : "bg-muted"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold">Scan to connect</p>
                <p className="mt-1 text-xs text-muted-foreground">No new customer number required</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm md:col-span-5">
            <Feature icon={Globe} title="Branded public quote page" text="A clean /s/[slug] experience for customers who want to request a quote." />
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
                <span className="ml-auto rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  leadmachine.co.za/s/plumber-sipho
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Wrench className="h-4 w-4" />
                  <span className="text-sm font-semibold">Sipho Plumbing</span>
                </div>
                <p className="mt-3 text-lg font-semibold">Tell us about the job.</p>
                <div className="mt-4 space-y-2">
                  <FormLine label="Your suburb" value="Bryanston" />
                  <FormLine label="What do you need?" value="Emergency geyser repair" />
                  <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">
                    Request quote <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm md:col-span-7">
            <div className="flex items-start justify-between">
              <Feature icon={Inbox} title="One inbox, clear next action" text="Open, understand and act without digging through personal WhatsApp chats." />
              <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary sm:inline-flex">
                Live inbox
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { name: "Sipho M.", meta: "Burst geyser · Bryanston", score: "10/10", tone: "hot" },
                { name: "Ayesha K.", meta: "Solar quote · Umhlanga", score: "7/10", tone: "warm" },
                { name: "Pieter V.", meta: "Price check · Midrand", score: "3/10", tone: "cold" },
              ].map((lead) => (
                <div key={lead.name} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{lead.name}</span>
                    <TemperatureBadge temperature={lead.tone} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{lead.meta}</p>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="font-semibold">{lead.score}</span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Phone className="h-3 w-3" /> Call
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-sm md:col-span-12">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">POPIA South Africa compliant capture</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Customer forms capture consent alongside the enquiry so your team can follow up with context.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium shadow-sm">
                <ShieldCheck className="h-4 w-4 text-primary" /> Consent captured
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-card/45">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-3xl">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Simple pricing in South African Rands.
            </h2>
            <p className="mt-3 text-muted-foreground">Cancel any time. Prices include VAT.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                n: "Starter",
                p: "R299",
                f: ["1 WhatsApp number", "Instant auto-replies", "Lead inbox", "Business page"],
              },
              {
                n: "Pro",
                p: "R499",
                f: ["Everything in Starter", "AI lead scoring", "AI reply drafts", "After-hours routing"],
                hi: true,
              },
              {
                n: "Team",
                p: "R899",
                f: ["Everything in Pro", "Up to 5 team members", "Priority support", "Custom page address"],
              },
            ].map((t) => (
              <div
                key={t.n}
                className={`rounded-3xl border bg-card p-6 shadow-sm ${t.hi ? "border-primary shadow-soft" : "border-border"}`}
              >
                <p className="font-semibold">{t.n}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">
                  {t.p}
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  {t.f.map((x) => (
                    <li key={x} className="flex gap-2">
                      <CheckCheck className="h-4 w-4 shrink-0 text-primary" />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  className={`mt-6 block rounded-xl py-2.5 text-center text-sm font-semibold transition-transform hover:-translate-y-0.5 ${t.hi ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-accent"}`}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft md:p-12">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
            Stop losing jobs to slow replies.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Capture the enquiry, understand the opportunity and take the next action before the lead
            goes cold.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
          >
            Start your free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground">
          <Logo />
          <span>© {new Date().getFullYear()} LeadMachine · Made in South Africa</span>
        </div>
      </footer>
    </div>
  );
}

function DemandRadarPreview() {
  return (
    <div className="mt-10 rounded-[2rem] border border-border bg-card p-3 shadow-soft sm:p-5">
      <div className="flex flex-col gap-3 border-b border-border px-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Demand Radar · Live signal</p>
          <p className="mt-1 text-xs text-muted-foreground">Public community post → buying intent → owner alert</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[10px] font-semibold text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Monitoring public demand
        </span>
      </div>

      <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-3xl border border-border bg-background p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-sm font-bold text-muted-foreground">SC</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Community enquiry</p>
              <p className="text-[11px] text-muted-foreground">Sandton community · 3 min ago</p>
            </div>
            <span className="rounded-full border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">Public</span>
          </div>
          <p className="mt-5 text-sm leading-6 text-foreground">
            “Looking for a reliable plumber in Sandton. My geyser burst and I need someone tonight. Any recommendations?”
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">Sandton</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">Plumbing</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">Urgent</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 px-1 py-1 lg:w-28 lg:px-0">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/5 text-primary">
            <span className="absolute inset-0 animate-ping rounded-full border border-primary/15" />
            <Radio className="relative h-5 w-5" />
          </div>
          <p className="max-w-[130px] text-center text-[10px] font-semibold leading-4 text-primary">LeadMachine detected buying intent</p>
          <div className="hidden h-px w-full bg-border lg:block" />
          <MapPinned className="hidden h-4 w-4 text-muted-foreground lg:block" />
        </div>

        <div className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">NEW LEAD SIGNAL</p>
              <p className="mt-1 text-sm font-semibold">Plumbing demand detected</p>
            </div>
            <TemperatureBadge temperature="hot" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <MiniStat label="Service" value="Plumbing" />
            <MiniStat label="Location" value="Sandton" />
            <MiniStat label="Intent" value="High" />
            <MiniStat label="Urgency" value="Tonight" />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/20 bg-card px-3 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Buying intent</p>
              <p className="mt-0.5 text-lg font-semibold">Hot lead</p>
            </div>
            <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">10/10</span>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <Bell className="h-3.5 w-3.5 text-primary" /> LeadMachine alerted you
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">Exact post + source link sent to the owner's connected alert channel.</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground">
              View signal <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Gauge;
  title: string;
  text: string;
}) {
  return (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{text}</p>
    </>
  );
}

function HeroStory() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2.25rem] bg-primary/5 blur-2xl" />
      <div className="relative rounded-[2rem] border border-border bg-card p-3 shadow-soft sm:p-4">
        <div className="mb-3 flex items-center justify-between px-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Live enquiry → LeadMachine
          </span>
          <span>Sandton · 21:15</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <PhoneMockup />
          <DashboardMockup />
        </div>
      </div>
      <div className="absolute -bottom-5 left-6 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-soft sm:block">
        <p className="text-[11px] text-muted-foreground">Average automated reply</p>
        <p className="text-xl font-semibold text-primary">2.4 sec</p>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="rounded-[1.5rem] border border-border bg-background p-2 shadow-sm">
      <div className="rounded-[1.15rem] border border-border bg-card p-3">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            WA
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold">Sipho Plumbing</p>
            <p className="text-[10px] text-muted-foreground">Business · Online</p>
          </div>
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-2 py-4 text-[12px] leading-5">
          <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-3 py-2.5">
            Hi, our geyser burst in Bryanston. Can someone come tonight?
          </div>
          <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3 py-2.5 text-primary-foreground">
            Yes — we have an emergency team on call in Sandton. What's your street address?
            <p className="mt-1 flex items-center gap-1 text-[9px] opacity-70">
              <Bot className="h-3 w-3" /> Auto-reply · 2.2s
            </p>
          </div>
          <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-3 py-2.5">
            14 The Crescent. Need it sorted tonight please.
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-[10px]">
          <span className="text-muted-foreground">Message captured</span>
          <span className="font-semibold text-primary">21:15:04</span>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="rounded-[1.5rem] border border-border bg-background p-2 shadow-sm">
      <div className="rounded-[1.15rem] border border-border bg-card p-3">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Inbox className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold">LeadMachine Inbox</p>
            <p className="text-[10px] text-muted-foreground">1 new lead · AI analysed</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">
            LIVE
          </span>
        </div>
        <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">HOT LEAD</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Sipho M. · Bryanston</p>
            </div>
            <div className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
              10/10
            </div>
          </div>
          <p className="mt-3 text-xs leading-5">
            “Emergency geyser repair requested tonight. Address collected. Immediate dispatch
            needed.”
          </p>
          <div className="mt-4 flex gap-2">
            <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 py-2 text-[10px] font-semibold text-primary-foreground">
              <Phone className="h-3 w-3" /> Call client
            </button>
            <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 text-[10px] font-semibold">
              <Send className="h-3 w-3" /> Quote link
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
          <MiniStat label="Reply time" value="2.4s" />
          <MiniStat label="Intent" value="Hot" />
          <MiniStat label="Suburb" value="Sandton" />
        </div>
      </div>
    </div>
  );
}

function StoryCard({
  eyebrow,
  title,
  tone,
  icon: Icon,
  children,
}: {
  eyebrow: string;
  title: string;
  tone: "muted" | "primary";
  icon: typeof Gauge;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 shadow-sm ${
        tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tone === "primary" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
          <p className="mt-1 text-lg font-semibold">{title}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function LifeCard({
  time,
  title,
  body,
  stat,
  icon: Icon,
}: {
  time: string;
  title: string;
  body: string;
  stat: string;
  icon: typeof Gauge;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {time}
            </p>
            <p className="mt-1 text-lg font-semibold">{title}</p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
          {stat}
        </span>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-primary">
        <ArrowRight className="h-3.5 w-3.5" /> LeadMachine keeps moving
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2.5 py-2">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold">{value}</p>
    </div>
  );
}

function FormLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-medium">{value}</p>
    </div>
  );
}
