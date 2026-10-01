-- Store one Operator tenant-scoped credential per LeadMachine tenant.
-- The credential is server-only. Authenticated users receive no table privileges.
CREATE TABLE IF NOT EXISTS public.whatsapp_operator_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  wa_account_id text,
  tenant_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_operator_credentials_tenant_idx
  ON public.whatsapp_operator_credentials (tenant_id);

REVOKE ALL ON TABLE public.whatsapp_operator_credentials FROM anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_operator_credentials TO service_role;

ALTER TABLE public.whatsapp_operator_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role whatsapp operator credentials" ON public.whatsapp_operator_credentials;
CREATE POLICY "service role whatsapp operator credentials"
  ON public.whatsapp_operator_credentials
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
