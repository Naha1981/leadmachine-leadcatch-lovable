-- Weekly content plan: drafts only. Nothing is published by the system; approval is a status the owner sets.
CREATE TABLE IF NOT EXISTS public.weekly_content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  post_day text NOT NULL,
  topic text NOT NULL,
  source text NOT NULL CHECK (source IN ('radar','enquiries','bookings','trend')),
  source_note text,
  copy text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weekly_content_posts_idx ON public.weekly_content_posts (tenant_id, week_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_content_posts TO authenticated;
GRANT ALL ON public.weekly_content_posts TO service_role;
ALTER TABLE public.weekly_content_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant manage weekly content" ON public.weekly_content_posts;
CREATE POLICY "tenant manage weekly content" ON public.weekly_content_posts FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
