import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Search, TrendingUp } from "lucide-react";
import { MarketIntelligencePanel } from "@/components/MarketIntelligencePanel";
import { Card, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/_shell/insights")({
  head: () => ({
    meta: [
      { title: "Insights — RevenueDesk" },
      { name: "description", content: "Turn customer conversations and market signals into evidence-backed actions." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title="Insights"
        subtitle="RevenueDesk learns from the demand around your business instead of making you search for it manually."
        action={<Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">Back to Revenue Desk <ArrowRight className="h-4 w-4" /></Link>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InsightCard icon={Search} title="Customer problems" text="Recurring questions and problems worth answering or turning into offers." />
        <InsightCard icon={TrendingUp} title="Competitor opportunities" text="Observed gaps and changes in the market around the business." />
        <InsightCard icon={BarChart3} title="Content and lead opportunities" text="Evidence-backed topics that can become content, campaigns or new enquiry paths." />
      </div>

      <MarketIntelligencePanel />
    </div>
  );
}

function InsightCard({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return <Card className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></Card>;
}
