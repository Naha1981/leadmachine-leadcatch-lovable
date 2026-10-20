-- Social posting: link weekly plan items to channel posts + server-only service config.
ALTER TABLE public.weekly_content_posts
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS channel_post_id text,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS posted_url text,
  ADD COLUMN IF NOT EXISTS publish_state text CHECK (publish_state IN ('scheduled','published','failed')),
  ADD COLUMN IF NOT EXISTS post_error text;

CREATE TABLE IF NOT EXISTS public.service_config (
  key text PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.service_config ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.service_config TO service_role;
-- No authenticated policies: clients can never read server config.
