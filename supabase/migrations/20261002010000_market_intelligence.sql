-- LeadMachine Market Intelligence
-- Evidence-backed, tenant-scoped, refreshable market intelligence.

CREATE TABLE IF NOT EXISTS public.market_intelligence_platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.market_intelligence_platform_settings (id, enabled)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS market_intelligence_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS market_intelligence_website text;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS market_intelligence_keywords jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS market_intelligence_source_preferences jsonb NOT NULL DEFAULT '{"reddit":true,"web":true,"youtube":true,"x":true}'::jsonb;

CREATE TABLE IF NOT EXISTS public.market_intelligence_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  website_url text NOT NULL,
  source text NOT NULL DEFAULT 'auto_discovered',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ignored')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, website_url)
);

CREATE INDEX IF NOT EXISTS market_intelligence_competitors_tenant_status_idx
  ON public.market_intelligence_competitors (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.market_intelligence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (
    category IN (
      'CUSTOMER_PROBLEMS',
      'COMPETITOR_OPPORTUNITIES',
      'UNANSWERED_QUESTIONS',
      'CONTENT_OPPORTUNITIES',
      'LEAD_GENERATION_OPPORTUNITIES'
    )
  ),
  cluster_key text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  observed_claim text NOT NULL,
  inference text NOT NULL,
  recommended_action text NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_strength text NOT NULL DEFAULT 'weak' CHECK (evidence_strength IN ('insufficient','weak','medium','high')),
  recurrence_count integer NOT NULL DEFAULT 0 CHECK (recurrence_count >= 0),
  source_diversity integer NOT NULL DEFAULT 0 CHECK (source_diversity >= 0),
  relevance_score numeric(5,4) NOT NULL DEFAULT 0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  freshness_score numeric(5,4) NOT NULL DEFAULT 0 CHECK (freshness_score >= 0 AND freshness_score <= 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','dismissed')),
  first_observed_at timestamptz NOT NULL DEFAULT now(),
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, category, cluster_key)
);

CREATE INDEX IF NOT EXISTS market_intelligence_signals_tenant_category_idx
  ON public.market_intelligence_signals (tenant_id, category, status, last_observed_at DESC);

CREATE INDEX IF NOT EXISTS market_intelligence_signals_tenant_rank_idx
  ON public.market_intelligence_signals (
    tenant_id,
    status,
    freshness_score DESC,
    confidence DESC,
    relevance_score DESC
  );

CREATE TABLE IF NOT EXISTS public.market_intelligence_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES public.market_intelligence_signals(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('reddit','youtube','x','web','competitor','website','internal','agent_reach')),
  source_url text NOT NULL,
  external_id text,
  title text NOT NULL DEFAULT '',
  author text,
  published_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  evidence_text text NOT NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, evidence_hash)
);

CREATE INDEX IF NOT EXISTS market_intelligence_evidence_signal_idx
  ON public.market_intelligence_evidence (tenant_id, signal_id, discovered_at DESC);

CREATE INDEX IF NOT EXISTS market_intelligence_evidence_source_idx
  ON public.market_intelligence_evidence (tenant_id, source_type, discovered_at DESC);

CREATE TABLE IF NOT EXISTS public.market_intelligence_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'regular' CHECK (mode IN ('regular','daily')),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  documents_collected integer NOT NULL DEFAULT 0,
  candidate_signals integer NOT NULL DEFAULT 0,
  accepted_signals integer NOT NULL DEFAULT 0,
  duplicates_removed integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS market_intelligence_runs_tenant_started_idx
  ON public.market_intelligence_runs (tenant_id, started_at DESC);

GRANT SELECT ON public.market_intelligence_platform_settings TO authenticated;
GRANT ALL ON public.market_intelligence_platform_settings TO service_role;
GRANT SELECT ON public.market_intelligence_competitors TO authenticated;
GRANT ALL ON public.market_intelligence_competitors TO service_role;
GRANT SELECT ON public.market_intelligence_signals TO authenticated;
GRANT ALL ON public.market_intelligence_signals TO service_role;
GRANT SELECT ON public.market_intelligence_evidence TO authenticated;
GRANT ALL ON public.market_intelligence_evidence TO service_role;
GRANT SELECT ON public.market_intelligence_runs TO authenticated;
GRANT ALL ON public.market_intelligence_runs TO service_role;

ALTER TABLE public.market_intelligence_platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market intelligence platform read" ON public.market_intelligence_platform_settings;
CREATE POLICY "market intelligence platform read"
  ON public.market_intelligence_platform_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tenant read market intelligence competitors" ON public.market_intelligence_competitors;
CREATE POLICY "tenant read market intelligence competitors"
  ON public.market_intelligence_competitors
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant read market intelligence signals" ON public.market_intelligence_signals;
CREATE POLICY "tenant read market intelligence signals"
  ON public.market_intelligence_signals
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant read market intelligence evidence" ON public.market_intelligence_evidence;
CREATE POLICY "tenant read market intelligence evidence"
  ON public.market_intelligence_evidence
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant read market intelligence runs" ON public.market_intelligence_runs;
CREATE POLICY "tenant read market intelligence runs"
  ON public.market_intelligence_runs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS trg_market_intelligence_competitors_updated ON public.market_intelligence_competitors;
CREATE TRIGGER trg_market_intelligence_competitors_updated
  BEFORE UPDATE ON public.market_intelligence_competitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_market_intelligence_signals_updated ON public.market_intelligence_signals;
CREATE TRIGGER trg_market_intelligence_signals_updated
  BEFORE UPDATE ON public.market_intelligence_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Keep the dashboard useful immediately after deployment: existing tenants are opted in,
-- while the platform switch remains available for a controlled rollback.
UPDATE public.business_profiles
SET market_intelligence_enabled = COALESCE(market_intelligence_enabled, true)
WHERE market_intelligence_enabled IS NULL;
