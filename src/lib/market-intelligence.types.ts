export type MarketIntelligenceEvidence = {
  id: string;
  source: string;
  sourceType: string;
  sourceUrl: string;
  externalId: string | null;
  title: string;
  author: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  evidenceText: string;
  sourceMetadata: Record<string, unknown>;
};

export type MarketIntelligenceSignal = {
  id: string;
  category: string;
  title: string;
  summary: string;
  observedClaim: string;
  inference: string;
  recommendedAction: string;
  confidence: number;
  evidenceStrength: string;
  recurrenceCount: number;
  sourceDiversity: number;
  relevanceScore: number;
  freshnessScore: number;
  status: string;
  firstObservedAt: string;
  lastObservedAt: string;
  expiresAt: string | null;
  evidence: MarketIntelligenceEvidence[];
};

export type MarketIntelligenceSnapshot = {
  enabled: boolean;
  updatedAt: string | null;
  categories: Record<string, MarketIntelligenceSignal[]>;
  stats: {
    totalActive: number;
    evidenceCount: number;
    lastRunAt: string | null;
  };
};

export type MarketIntelligenceActionKind =
  | "FAQ"
  | "OFFER"
  | "WHATSAPP_RESPONSE"
  | "COMPETITOR_ANALYSIS"
  | "COUNTER_OFFER"
  | "LANDING_PAGE_BRIEF"
  | "ARTICLE"
  | "AUTO_REPLY_SNIPPET"
  | "CONTENT_POST"
  | "CAMPAIGN_BRIEF"
  | "LEAD_FORM"
  | "WHATSAPP_CAMPAIGN";
