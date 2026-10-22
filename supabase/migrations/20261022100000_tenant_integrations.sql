-- Per-tenant integration secrets (e.g. a tenant's own AI assistant key).
-- api_key holds AES-256-GCM ciphertext (v1.<iv>.<ct>, AAD = tenant_id+provider)
-- written by src/lib/integration-secrets.server.ts; plaintext is never stored.
-- Server-only, same model as public.service_config: RLS on, no authenticated
-- policies, only the service role can read or write.
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key text NOT NULL,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','error')),
  external_label text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, provider)
);
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tenant_integrations TO service_role;
-- No authenticated policies: clients can never read integration secrets.
