import type { ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Search, TrendingUp } from "lucide-react";
import { MarketIntelligencePanel } from "@/components/MarketIntelligencePanel";
import { Card, PageHeader } from "@/components/ui-bits";
import { useWorkspace } from "@/lib/workspace";
import { getIndustryExperience } from "@/lib/industry-experiences";

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
  const { data: ws } = useWorkspace();
  const experience = getIndustryExperience(ws?.profile.industry);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title={experience ? experience.label + " Insights" : "Insights"}
        subtitle={experience?.subheadline ?? "RevenueDesk learns from the demand around your business instead of making you search for it manually."}
        action={<Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent">Back to Revenue Desk <ArrowRight className="h-4 w-4" /></Link>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InsightCard
          icon={Search}
          title={experience ? experience.label + " demand" : "Customer problems"}
          text={experience?.problem ?? "Recurring questions and problems worth answering or turning into offers."}
        />
        <InsightCard
          icon={TrendingUp}
          title="Conversion opportunities"
          text={experience ? experience.outcome : "Observed gaps and changes in the market around the business."}
        />
        <InsightCard
          icon={BarChart3}
          title="Next best opportunities"
          text={experience ? "Use customer conversations, missed enquiries and service patterns to find the next offer, campaign or follow-up path." : "Evidence-backed topics that can become content, campaigns or new enquiry paths."}
        />
      </div>

      {experience && (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Built for {experience.label.toLowerCase()}</p>
          <p className="mt-2 text-lg font-semibold">{experience.headline}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{experience.outcome}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {experience.services.map((service) => (
              <span key={service} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">{service}</span>
            ))}
          </div>
        </Card>
      )}

      <MarketIntelligencePanel />
    </div>
  );
}

function InsightCard({ icon: Icon, title, text }: { icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return <Card className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></Card>;
}
