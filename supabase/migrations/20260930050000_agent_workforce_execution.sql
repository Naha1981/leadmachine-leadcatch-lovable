-- NahaLabs Agent Workforce execution receipts.
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

CREATE INDEX IF NOT EXISTS zero_ui_action_receipts_action_created_idx
  ON public.zero_ui_action_receipts (agent_action_id, created_at ASC);

CREATE INDEX IF NOT EXISTS zero_ui_action_receipts_tenant_created_idx
  ON public.zero_ui_action_receipts (tenant_id, created_at DESC);

GRANT SELECT ON public.zero_ui_action_receipts TO authenticated;
GRANT ALL ON public.zero_ui_action_receipts TO service_role;

ALTER TABLE public.zero_ui_action_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant read zero ui action receipts" ON public.zero_ui_action_receipts;
CREATE POLICY "tenant read zero ui action receipts"
  ON public.zero_ui_action_receipts
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
