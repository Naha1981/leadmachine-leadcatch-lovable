import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CreditCard, MessageCircle, Radar, RefreshCcw, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "2ndLife — Revenue Recovery Intelligence for SA Franchises" },
      {
        name: "description",
        content:
          "2ndLife recovers the revenue your business already earned: AI WhatsApp conversations, instant payments and measured attribution.",
      },
      { property: "og:title", content: "2ndLife — Revenue Recovery Intelligence" },
      {
        property: "og:description",
        content: "Recover lapsed customers over WhatsApp and prove every rand recovered.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Radar,
    title: "Demand Radar",
    body: "Detects what your market is actually asking for, before your competitors publish an answer.",
  },
  {
    icon: MessageCircle,
    title: "AI WhatsApp conversations",
    body: "Every dormant customer gets a real conversation in their language, supervised by your team.",
  },
  {
    icon: CreditCard,
    title: "Instant payments",
    body: "Pay links inside the chat. Webhook-verified, so recovered revenue is never estimated.",
  },
  {
    icon: RefreshCcw,
    title: "Recovery Engine",
    body: "Lapsed policies, abandoned quotes and failed debit orders reworked automatically.",
  },
  {
    icon: BarChart3,
    title: "Twelve-leakage model",
    body: "See exactly where money leaves the business — and what each leak is worth this month.",
  },
  {
    icon: ShieldCheck,
    title: "Built for compliance",
    body: "POPIA-aware consent, opt-out handling and full audit trails on every message sent.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/auth" search={{ redirect: undefined }}>
              Sign in
            </Link>
          </Button>
          <Button asChild>
            <Link to="/auth" search={{ redirect: "/dashboard" }}>
              Get started
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            Revenue Recovery Intelligence
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Your next R1 million is already in your database.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            2ndLife gives South African franchise networks a second shot at every lapsed policy,
            abandoned quote and unanswered lead — over WhatsApp, with payment proof attached.
          </p>
          <div className="mt-10 flex justify-center">
            <Button size="lg" asChild>
              <Link to="/auth" search={{ redirect: "/dashboard" }}>
                Open your Revenue OS <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-card/40 py-20">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
          <Logo />
          <p>© {new Date().getFullYear()} 2ndLife Revenue OS. Built for South Africa.</p>
        </div>
      </footer>
    </div>
  );
}
