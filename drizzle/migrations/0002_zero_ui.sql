-- LeadMachine Zero UI foundation.
CREATE TABLE IF NOT EXISTS public.zero_ui_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  automation_enabled boolean NOT NULL DEFAULT true,
  owner_alerts_enabled boolean NOT NULL DEFAULT true,
  auto_followups_enabled boolean NOT NULL DEFAULT true,
  require_followup_approval boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zero_ui_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  intent text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','ignored')),
  provider text,
  model text,
  correlation_id text,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS zero_ui_agent_runs_tenant_started_idx
  ON public.zero_ui_agent_runs (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.zero_ui_agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES public.zero_ui_agent_runs(id) ON DELETE SET NULL,
  action text NOT NULL,
  action_class text NOT NULL CHECK (action_class IN ('automatic','approval_required','forbidden')),
  target_type text,
  target_id text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','rejected')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS zero_ui_agent_actions_tenant_created_idx
  ON public.zero_ui_agent_actions (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.zero_ui_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_action_id uuid NOT NULL UNIQUE REFERENCES public.zero_ui_agent_actions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  note text
);

CREATE TABLE IF NOT EXISTS public.zero_ui_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  idempotency_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zero_ui_usage_events_tenant_occurred_idx
  ON public.zero_ui_usage_events (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.zero_ui_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('owner_whatsapp','staff','agent','system','user')),
  actor_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success','failed','rejected','ignored')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zero_ui_audit_logs_tenant_created_idx
  ON public.zero_ui_audit_logs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.zero_ui_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  message text NOT NULL,
  reason text NOT NULL DEFAULT 'owner_request',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  agent_action_id uuid REFERENCES public.zero_ui_agent_actions(id) ON DELETE SET NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zero_ui_followups_due_idx
  ON public.zero_ui_followups (tenant_id, status, scheduled_at);

INSERT INTO public.zero_ui_configs (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

GRANT SELECT ON public.zero_ui_configs, public.zero_ui_agent_runs, public.zero_ui_agent_actions, public.zero_ui_approvals, public.zero_ui_usage_events, public.zero_ui_audit_logs, public.zero_ui_followups TO authenticated;
GRANT ALL ON public.zero_ui_configs, public.zero_ui_agent_runs, public.zero_ui_agent_actions, public.zero_ui_approvals, public.zero_ui_usage_events, public.zero_ui_audit_logs, public.zero_ui_followups TO service_role;

ALTER TABLE public.zero_ui_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant read zero ui configs" ON public.zero_ui_configs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant update zero ui configs" ON public.zero_ui_configs FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant read zero ui runs" ON public.zero_ui_agent_runs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant read zero ui actions" ON public.zero_ui_agent_actions FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant read zero ui approvals" ON public.zero_ui_approvals FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant read zero ui usage" ON public.zero_ui_usage_events FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant read zero ui audit" ON public.zero_ui_audit_logs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "tenant read zero ui followups" ON public.zero_ui_followups FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS trg_zero_ui_configs_updated ON public.zero_ui_configs;
CREATE TRIGGER trg_zero_ui_configs_updated BEFORE UPDATE ON public.zero_ui_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();