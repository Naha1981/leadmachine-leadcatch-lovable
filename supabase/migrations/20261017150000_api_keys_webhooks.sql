-- Closeline: per-tenant API keys + outbound webhooks on the base plan.
CREATE TABLE IF NOT EXISTS public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Default',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS tenant_api_keys_tenant_idx ON public.tenant_api_keys (tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{lead.created}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_webhooks_tenant_idx ON public.tenant_webhooks (tenant_id, active);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.tenant_webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status int,
  ok boolean,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_tenant_idx ON public.webhook_deliveries (tenant_id, attempted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_webhooks TO authenticated;
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.tenant_api_keys TO service_role;
GRANT ALL ON public.tenant_webhooks TO service_role;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant manage api keys" ON public.tenant_api_keys;
CREATE POLICY "tenant manage api keys" ON public.tenant_api_keys FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant manage webhooks" ON public.tenant_webhooks;
CREATE POLICY "tenant manage webhooks" ON public.tenant_webhooks FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant read deliveries" ON public.webhook_deliveries;
CREATE POLICY "tenant read deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
