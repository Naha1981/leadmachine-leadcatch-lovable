export const MARKET_INTELLIGENCE_CATEGORIES = [
  "CUSTOMER_PROBLEMS",
  "COMPETITOR_OPPORTUNITIES",
  "UNANSWERED_QUESTIONS",
  "CONTENT_OPPORTUNITIES",
  "LEAD_GENERATION_OPPORTUNITIES",
] as const;

export type MarketIntelligenceCategory = (typeof MARKET_INTELLIGENCE_CATEGORIES)[number];

export const MARKET_INTELLIGENCE_LIMITS: Record<MarketIntelligenceCategory, number> = {
  CUSTOMER_PROBLEMS: 3,
  COMPETITOR_OPPORTUNITIES: 5,
  UNANSWERED_QUESTIONS: 7,
  CONTENT_OPPORTUNITIES: 4,
  LEAD_GENERATION_OPPORTUNITIES: 2,
};

export const MARKET_INTELLIGENCE_EXPIRY_DAYS: Record<MarketIntelligenceCategory, number> = {
  CUSTOMER_PROBLEMS: 14,
  COMPETITOR_OPPORTUNITIES: 14,
  UNANSWERED_QUESTIONS: 10,
  CONTENT_OPPORTUNITIES: 7,
  LEAD_GENERATION_OPPORTUNITIES: 3,
};

export const MARKET_INTELLIGENCE_CATEGORY_LABELS: Record<MarketIntelligenceCategory, string> = {
  CUSTOMER_PROBLEMS: "Customer Problems",
  COMPETITOR_OPPORTUNITIES: "Competitor Opportunities",
  UNANSWERED_QUESTIONS: "Unanswered Questions",
  CONTENT_OPPORTUNITIES: "Content Opportunities",
  LEAD_GENERATION_OPPORTUNITIES: "Lead Opportunities",
};

export const MARKET_INTELLIGENCE_SOURCE_TYPES = [
  "reddit",
  "youtube",
  "x",
  "web",
  "competitor",
  "website",
  "internal",
  "agent_reach",
] as const;

export type MarketIntelligenceSourceType = (typeof MARKET_INTELLIGENCE_SOURCE_TYPES)[number];
