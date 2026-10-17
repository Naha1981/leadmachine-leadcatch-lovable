-- Closeline: customer intake photos on public business pages.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT '{}';

-- Private bucket; owners read via tenant-scoped policy, anyone can upload into a tenant folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-photos', 'lead-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public upload lead photos" ON storage.objects;
CREATE POLICY "public upload lead photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'lead-photos');

DROP POLICY IF EXISTS "tenant read lead photos" ON storage.objects;
CREATE POLICY "tenant read lead photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lead-photos'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "tenant delete lead photos" ON storage.objects;
CREATE POLICY "tenant delete lead photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lead-photos'
    AND public.is_tenant_member(((storage.foldername(name))[1])::uuid)
  );
