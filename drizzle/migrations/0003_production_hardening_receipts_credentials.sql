CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.zero_ui_platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.zero_ui_platform_settings (id, enabled) VALUES (true, true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.zero_ui_configs ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT true;
GRANT ALL ON public.platform_admins TO service_role;
GRANT ALL ON public.zero_ui_platform_settings TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform admins service access" ON public.platform_admins;
CREATE POLICY "platform admins service access" ON public.platform_admins FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "platform settings service access" ON public.zero_ui_platform_settings;
CREATE POLICY "platform settings service access" ON public.zero_ui_platform_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.zero_ui_action_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_action_id uuid NOT NULL REFERENCES public.zero_ui_agent_actions(id) ON DELETE CASCADE,
  step text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('started','completed','failed','skipped','outcome_unknown')),
  external_id text,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zero_ui_action_receipts_action_created_idx ON public.zero_ui_action_receipts (agent_action_id, created_at ASC);
CREATE INDEX IF NOT EXISTS zero_ui_action_receipts_tenant_created_idx ON public.zero_ui_action_receipts (tenant_id, created_at DESC);
GRANT SELECT ON public.zero_ui_action_receipts TO authenticated;
GRANT ALL ON public.zero_ui_action_receipts TO service_role;
ALTER TABLE public.zero_ui_action_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant read zero ui action receipts" ON public.zero_ui_action_receipts;
CREATE POLICY "tenant read zero ui action receipts" ON public.zero_ui_action_receipts FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

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
CREATE INDEX IF NOT EXISTS whatsapp_operator_credentials_tenant_idx ON public.whatsapp_operator_credentials (tenant_id);
REVOKE ALL ON TABLE public.whatsapp_operator_credentials FROM anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_operator_credentials TO service_role;
ALTER TABLE public.whatsapp_operator_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role whatsapp operator credentials" ON public.whatsapp_operator_credentials;
CREATE POLICY "service role whatsapp operator credentials" ON public.whatsapp_operator_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.quote_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  ip_hash text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_submissions_ip_idx ON public.quote_submissions (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS quote_submissions_phone_idx ON public.quote_submissions (phone, created_at DESC);
GRANT ALL ON public.quote_submissions TO service_role;
ALTER TABLE public.quote_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role quote submissions" ON public.quote_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);