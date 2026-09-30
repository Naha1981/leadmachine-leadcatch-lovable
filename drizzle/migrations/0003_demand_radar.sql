-- LeadMachine Demand Radar: public buying-signal capture and owner alerts.
CREATE TABLE IF NOT EXISTS public.demand_radar_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  source_name text,
  source_url text NOT NULL,
  author text,
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  service text,
  suburb text,
  urgency text,
  intent_score integer NOT NULL DEFAULT 0 CHECK (intent_score BETWEEN 0 AND 10),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','alerted','dismissed','converted')),
  matched_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS demand_radar_signals_tenant_status_idx
  ON public.demand_radar_signals (tenant_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS demand_radar_signals_tenant_source_idx
  ON public.demand_radar_signals (tenant_id, source, detected_at DESC);

ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS demand_radar_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS demand_radar_terms jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS demand_radar_subreddits text[] NOT NULL DEFAULT '{}';

GRANT SELECT ON public.demand_radar_signals TO authenticated;
GRANT ALL ON public.demand_radar_signals TO service_role;
ALTER TABLE public.demand_radar_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant read demand radar signals" ON public.demand_radar_signals;
CREATE POLICY "tenant read demand radar signals"
  ON public.demand_radar_signals
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS trg_demand_radar_updated ON public.demand_radar_signals;
CREATE TRIGGER trg_demand_radar_updated
  BEFORE UPDATE ON public.demand_radar_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
