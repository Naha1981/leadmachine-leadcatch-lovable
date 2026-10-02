-- Raw normalized source documents for replaceable acquisition adapters.
CREATE TABLE IF NOT EXISTS public.market_intelligence_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('reddit','youtube','x','web','competitor','website','internal','agent_reach')),
  source_url text NOT NULL,
  external_id text,
  title text NOT NULL DEFAULT '',
  author text,
  published_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','processed','failed')),
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS market_intelligence_documents_tenant_status_idx
  ON public.market_intelligence_documents (tenant_id, status, discovered_at DESC);

GRANT SELECT ON public.market_intelligence_documents TO authenticated;
GRANT ALL ON public.market_intelligence_documents TO service_role;
ALTER TABLE public.market_intelligence_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant read market intelligence documents" ON public.market_intelligence_documents;
CREATE POLICY "tenant read market intelligence documents"
  ON public.market_intelligence_documents
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
