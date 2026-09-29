import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, CheckCheck, Clock, Gauge, Globe, Inbox, MessageCircle, QrCode, ShieldCheck, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TemperatureBadge } from "@/components/TemperatureBadge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadMachine — Turn WhatsApp enquiries into paying customers" },
      { name: "description", content: "Instant WhatsApp auto-replies, AI lead scoring and one inbox for South African service businesses." },
      { property: "og:title", content: "LeadMachine — Never lose a WhatsApp lead again" },
      { property: "og:description", content: "Instant WhatsApp auto-replies, AI lead scoring and one inbox for South African service businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#problem" className="hover:text-foreground">Why</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Log in</Link>
            <Link to="/auth" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Built for South African trades
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Turn WhatsApp enquiries into paying customers <span className="text-primary">in seconds.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            LeadMachine replies to every lead instantly, asks your questions, scores who is ready to buy and keeps it all in one inbox — even while you're on the job.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Start 14-day free trial</Link>
            <a href="#how" className="rounded-xl border border-border px-5 py-3 font-medium hover:bg-accent">See how it works</a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No card needed · POPIA compliant · Set up in 5 minutes</p>
        </div>
        <HeroMockup />
      </section>

      {/* Problem vs solution */}
      <section id="problem" className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">Most local jobs go to whoever replies first.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">You're under a sink, on a roof or driving. By the time you reply, they've booked someone else.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-6">
              <p className="text-sm font-semibold text-destructive">Without LeadMachine</p>
              <ul className="mt-4 space-y-3 text-sm">
                {["Reply 3 hours later — client already hired a competitor", "After-hours messages sit unread until Monday", "No idea which enquiries are serious", "Quotes lost in a messy personal WhatsApp"].map((t) => (
                  <li key={t} className="flex gap-2.5 text-muted-foreground"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/40 bg-background p-6">
              <p className="text-sm font-semibold text-primary">With LeadMachine</p>
              <ul className="mt-4 space-y-3 text-sm">
                {["Every lead gets a reply in under 3 seconds, 24/7", "Smart after-hours messages that still capture the job", "AI scores each lead Hot, Warm or Cold", "Every conversation organised in one inbox"].map((t) => (
                  <li key={t} className="flex gap-2.5"><CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Live in three steps</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { i: QrCode, t: "Scan a QR code", d: "Link your existing WhatsApp number. No new number, no app to install." },
            { i: MessageCircle, t: "Set your questions", d: "Service, suburb, urgency — LeadMachine asks them for you." },
            { i: Gauge, t: "Close the hot ones", d: "Open your inbox, see who's ready to buy, and reply with one tap." },
          ].map((s, n) => (
            <div key={s.t} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><s.i className="h-5 w-5" /></span>
                <span className="text-xs text-muted-foreground">Step {n + 1}</span>
              </div>
              <p className="mt-4 font-semibold">{s.t}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Everything to win the job</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <Feature icon={Gauge} title="AI lead scoring & reply drafts" text="See purchase intent at a glance and get a personal reply written around your services." />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[{ n: "Thandi M.", t: "hot", s: 9, m: "Geyser burst, need someone today" }, { n: "Pieter V.", t: "warm", s: 6, m: "How much for a DB board check?" }, { n: "+27 82…", t: "cold", s: 2, m: "Just checking prices" }].map((l) => (
                <div key={l.n} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between"><span className="text-sm font-medium">{l.n}</span><TemperatureBadge temperature={l.t} /></div>
                  <p className="mt-2 text-xs text-muted-foreground">{l.m}</p>
                  <p className="mt-2 text-xs font-semibold">{l.s}/10</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Feature icon={Clock} title="Business hours aware" text="Different replies for working hours, nights and weekends." />
            <div className="mt-5 space-y-2 text-xs">
              <div className="flex justify-between rounded-lg bg-background px-3 py-2"><span>Mon–Fri</span><span className="text-primary">07:00–17:00</span></div>
              <div className="flex justify-between rounded-lg bg-background px-3 py-2"><span>After hours</span><span className="text-muted-foreground">Callback message</span></div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Feature icon={Inbox} title="One inbox" text="Every WhatsApp lead with status: new, replied, qualified, closed." />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Feature icon={Globe} title="Your own business page" text="A free mini-site with services, FAQs and a quote form that feeds your inbox." />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Feature icon={ShieldCheck} title="POPIA compliant" text="Consent captured on every form. Your data stays private to your business." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Simple pricing in Rands</h2>
          <p className="mt-3 text-muted-foreground">Cancel any time. Prices include VAT.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { n: "Starter", p: "R299", f: ["1 WhatsApp number", "Instant auto-replies", "Lead inbox", "Business page"] },
              { n: "Pro", p: "R499", f: ["Everything in Starter", "AI lead scoring", "AI reply drafts", "After-hours routing"], hi: true },
              { n: "Team", p: "R899", f: ["Everything in Pro", "Up to 5 team members", "Priority support", "Custom page address"] },
            ].map((t) => (
              <div key={t.n} className={`rounded-2xl border bg-background p-6 ${t.hi ? "border-primary" : "border-border"}`}>
                <p className="font-semibold">{t.n}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight">{t.p}<span className="text-base font-normal text-muted-foreground">/month</span></p>
                <ul className="mt-5 space-y-2 text-sm">{t.f.map((x) => <li key={x} className="flex gap-2"><CheckCheck className="h-4 w-4 text-primary" />{x}</li>)}</ul>
                <Link to="/auth" className={`mt-6 block rounded-xl py-2.5 text-center text-sm font-semibold ${t.hi ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}>Start free trial</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Stop losing jobs to slow replies.</h2>
        <Link to="/auth" className="mt-7 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">Start your free trial</Link>
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

function Feature({ icon: Icon, title, text }: { icon: typeof Gauge; title: string; text: string }) {
  return (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></span>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
    </>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">TM</div>
          <div className="flex-1"><p className="text-sm font-semibold">Thandi M.</p><p className="text-[11px] text-muted-foreground">+27 82 555 0199</p></div>
          <span className="text-sm font-semibold">9/10</span><TemperatureBadge temperature="hot" />
        </div>
        <div className="space-y-2 py-4 text-sm">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2 text-secondary-foreground">Hi, do you do emergency geyser repairs in Sandton? Mine just burst 😩</div>
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
            Hi Thandi, yes we do! Please switch off the geyser at the DB board. Which street are you on so we can send the nearest plumber?
            <p className="mt-1 flex items-center gap-1 text-[10px] opacity-70"><Bot className="h-3 w-3" /> Auto · 2s</p>
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2 text-secondary-foreground">Rivonia Rd. How soon can you come?</div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs"><span className="font-semibold text-primary">AI: </span>Urgent burst geyser, ready to book now. Call within 10 minutes.</div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-border bg-background px-4 py-3 shadow-soft sm:block">
        <p className="text-[11px] text-muted-foreground">Average reply time</p>
        <p className="text-xl font-semibold text-primary">2.4 sec</p>
      </div>
    </div>
  );
}
