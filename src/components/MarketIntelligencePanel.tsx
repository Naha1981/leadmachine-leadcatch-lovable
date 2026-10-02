import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { getMarketIntelligence, createMarketIntelligenceAction } from "@/lib/market-intelligence.functions";
import { MARKET_INTELLIGENCE_CATEGORIES, MARKET_INTELLIGENCE_CATEGORY_LABELS, MARKET_INTELLIGENCE_LIMITS, type MarketIntelligenceCategory } from "@/lib/market-intelligence.constants";
import type { MarketIntelligenceSignal } from "@/lib/market-intelligence.types";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui-bits";
import { timeAgo } from "@/components/ui-bits";

const ACTIONS: Record<MarketIntelligenceCategory, Array<{ kind: string; label: string }>> = {
  CUSTOMER_PROBLEMS: [{ kind: "FAQ", label: "Create FAQ" }, { kind: "OFFER", label: "Create offer" }, { kind: "WHATSAPP_RESPONSE", label: "Draft WhatsApp response" }],
  COMPETITOR_OPPORTUNITIES: [{ kind: "COMPETITOR_ANALYSIS", label: "Analyse competitor" }, { kind: "COUNTER_OFFER", label: "Draft counter-offer" }, { kind: "LANDING_PAGE_BRIEF", label: "Draft landing-page brief" }],
  UNANSWERED_QUESTIONS: [{ kind: "FAQ", label: "Create FAQ" }, { kind: "ARTICLE", label: "Draft article" }, { kind: "AUTO_REPLY_SNIPPET", label: "Draft auto-reply" }],
  CONTENT_OPPORTUNITIES: [{ kind: "CONTENT_POST", label: "Draft post" }, { kind: "ARTICLE", label: "Draft article" }, { kind: "CAMPAIGN_BRIEF", label: "Draft campaign" }],
  LEAD_GENERATION_OPPORTUNITIES: [{ kind: "LEAD_FORM", label: "Draft lead form" }, { kind: "WHATSAPP_CAMPAIGN", label: "Draft WhatsApp campaign" }, { kind: "OFFER", label: "Draft offer" }],
};

export function MarketIntelligencePanel() {
  const intelligence = useQuery({ queryKey: ["market-intelligence"], queryFn: () => getMarketIntelligence({}), refetchInterval: 300_000 });
  const action = useServerFn(createMarketIntelligenceAction);
  const [openSignal, setOpenSignal] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ kind: string; text: string } | null>(null);

  const ordered = useMemo(() => MARKET_INTELLIGENCE_CATEGORIES.map((category) => ({ category, items: intelligence.data?.categories?.[category] ?? [] })), [intelligence.data]);
  const updatedLabel = intelligence.data?.updatedAt ? timeAgo(intelligence.data.updatedAt) : "waiting for first scan";

  if (intelligence.isLoading) return <Card className="p-5"><p className="text-sm text-muted-foreground">Market Intelligence is loading…</p></Card>;
  if (!intelligence.data?.enabled) return null;

  async function createDraft(signal: MarketIntelligenceSignal, kind: string) {
    setDrafting(signal.id + ":" + kind);
    try { setDraft({ kind, text: (await action({ data: { signalId: signal.id, kind } })).draft }); setOpenSignal(signal.id); }
    finally { setDrafting(null); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="text-sm font-medium text-muted-foreground">Market Intelligence</h2><p className="mt-1 text-xl font-semibold tracking-tight">LeadMachine is watching the market</p></div>
        <span className="shrink-0 text-xs text-muted-foreground">Updated {updatedLabel}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map(({ category, items }) => (
          <Card key={category} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div><p className="text-sm font-medium">{MARKET_INTELLIGENCE_CATEGORY_LABELS[category]}</p><p className="mt-1 text-xs text-muted-foreground">Top {MARKET_INTELLIGENCE_LIMITS[category]}</p></div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{items.length}/{MARKET_INTELLIGENCE_LIMITS[category]}</span>
            </div>
            <div className="divide-y divide-border">
              {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No evidence-backed finding yet.</p> : items.map((signal: MarketIntelligenceSignal) => {
                const open = openSignal === signal.id;
                return <div key={signal.id} className="p-4">
                  <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenSignal(open ? null : signal.id)}>
                    <div><p className="font-medium">{signal.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{signal.summary}</p></div>
                    <ChevronDown className={"mt-1 h-4 w-4 shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
                  </button>
                  {open && <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <Metric label="Evidence" value={String(signal.recurrenceCount)} />
                      <Metric label="Sources" value={String(signal.sourceDiversity)} />
                      <Metric label="Confidence" value={Math.round(signal.confidence * 100) + "%"} />
                    </div>
                    <div className="space-y-2 text-sm"><p><span className="font-medium">Observed:</span> {signal.observedClaim}</p><p className="text-muted-foreground"><span className="font-medium text-foreground">Inference:</span> {signal.inference}</p><p><span className="font-medium">Action:</span> {signal.recommendedAction}</p></div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                      {signal.evidence.map((item) => <div key={item.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium">{item.source}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a></div><p className="mt-1 text-xs text-muted-foreground">{item.evidenceText.slice(0, 420)}</p></div>)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ACTIONS[category].map((item) => <Button key={item.kind} size="sm" variant="secondary" disabled={drafting === signal.id + ":" + item.kind} onClick={() => createDraft(signal, item.kind)} className="rounded-xl"><Sparkles className="mr-2 h-3.5 w-3.5" />{drafting === signal.id + ":" + item.kind ? "Drafting…" : item.label}</Button>)}
                    </div>
                    {draft && openSignal === signal.id && <div className="rounded-xl bg-secondary p-4"><p className="text-xs font-medium">{draft.kind.replace(/_/g, " ")} draft</p><p className="mt-2 whitespace-pre-wrap text-sm">{draft.text}</p></div>}
                  </div>}
                </div>;
              })}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-secondary px-2.5 py-2"><p className="text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
