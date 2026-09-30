-- Zero UI hardening: platform owner boundary + daily proactive summaries.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.zero_ui_platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.zero_ui_platform_settings (id, enabled)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.zero_ui_configs
  ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT true;

GRANT SELECT ON public.platform_admins TO service_role;
GRANT ALL ON public.platform_admins TO service_role;
GRANT SELECT ON public.zero_ui_platform_settings TO service_role;
GRANT ALL ON public.zero_ui_platform_settings TO service_role;

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_ui_platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform admins service access" ON public.platform_admins;
CREATE POLICY "platform admins service access"
  ON public.platform_admins
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "platform settings service access" ON public.zero_ui_platform_settings;
CREATE POLICY "platform settings service access"
  ON public.zero_ui_platform_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
