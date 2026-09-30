-- LeadMachine launch hardening: vertical intelligence + 15-minute hot lead leakage alerts.
CREATE TABLE IF NOT EXISTS public.lead_leakage_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','sent','failed')),
  whatsapp_sent boolean NOT NULL DEFAULT false,
  sms_sent boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  alerted_at timestamptz
);

CREATE INDEX IF NOT EXISTS lead_leakage_alerts_tenant_status_idx
  ON public.lead_leakage_alerts (tenant_id, status, created_at DESC);

GRANT SELECT ON public.lead_leakage_alerts TO authenticated;
GRANT ALL ON public.lead_leakage_alerts TO service_role;

ALTER TABLE public.lead_leakage_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant read leakage alerts" ON public.lead_leakage_alerts;
CREATE POLICY "tenant read leakage alerts"
  ON public.lead_leakage_alerts
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_last_scored_message_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_hot_new_created_idx
  ON public.leads (tenant_id, ai_temperature, status, created_at);
