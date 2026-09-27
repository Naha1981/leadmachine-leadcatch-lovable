-- ============================================================
-- Merge LeadCatch Pro core + Lead Machine AI/public-site layer
-- Purely additive: adds columns, tables, triggers, indexes.
-- ============================================================

-- ---------- tenants ----------
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.tenants ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.tenants ALTER COLUMN slug SET DEFAULT ('t-' || replace(gen_random_uuid()::text, '-', ''));
UPDATE public.tenants t SET owner_id = p.id
  FROM public.profiles p WHERE p.tenant_id = t.id AND t.owner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_owner_id_key ON public.tenants (owner_id) WHERE owner_id IS NOT NULL;

-- ---------- business_profiles ----------
ALTER TABLE public.business_profiles ALTER COLUMN business_name SET DEFAULT '';
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT '';
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS wa_account_id text;
ALTER TABLE public.business_profiles ADD COLUMN IF NOT EXISTS whatsapp_last_synced_at timestamptz;
UPDATE public.business_profiles bp SET industry = bp.trade WHERE bp.industry = '' AND bp.trade <> '';
UPDATE public.business_profiles bp SET onboarded = true
  FROM public.tenants t WHERE t.id = bp.tenant_id AND t.onboarded = true;

-- ---------- auto_reply_configs (LeadCatch Pro column names) ----------
ALTER TABLE public.auto_reply_configs ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auto_reply_configs ADD COLUMN IF NOT EXISTS keyword_rules jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auto_reply_configs ADD COLUMN IF NOT EXISTS after_hours text NOT NULL DEFAULT 'Thanks for your message. We''re closed right now and will reply first thing tomorrow.';
ALTER TABLE public.auto_reply_configs ADD COLUMN IF NOT EXISTS handoff text NOT NULL DEFAULT 'Thanks! One of our team will reply to you shortly.';
UPDATE public.auto_reply_configs SET
  questions = COALESCE(to_jsonb(qualification_questions), '[]'::jsonb),
  after_hours = after_hours_message,
  handoff = handoff_message
WHERE questions = '[]'::jsonb;
COMMENT ON COLUMN public.auto_reply_configs.qualification_questions IS 'DEPRECATED: replaced by questions (jsonb)';
COMMENT ON COLUMN public.auto_reply_configs.after_hours_message IS 'DEPRECATED: replaced by after_hours';
COMMENT ON COLUMN public.auto_reply_configs.handoff_message IS 'DEPRECATED: replaced by handoff';

-- ---------- leads: closed status + AI scoring ----------
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_temperature text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz;

-- ---------- lead_events: LeadCatch Pro names, kept in sync ----------
ALTER TABLE public.lead_events ALTER COLUMN event_type SET DEFAULT '';
ALTER TABLE public.lead_events ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.lead_events ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.lead_events SET type = event_type WHERE type IS NULL;

CREATE OR REPLACE FUNCTION public.sync_lead_event_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type IS NULL OR NEW.type = '' THEN NEW.type := NULLIF(NEW.event_type, ''); END IF;
  IF NEW.event_type IS NULL OR NEW.event_type = '' THEN NEW.event_type := COALESCE(NEW.type, 'event'); END IF;
  IF NEW.type IS NULL THEN NEW.type := NEW.event_type; END IF;
  IF NEW.metadata = '{}'::jsonb AND NEW.payload <> '{}'::jsonb THEN NEW.metadata := NEW.payload; END IF;
  IF NEW.payload = '{}'::jsonb AND NEW.metadata <> '{}'::jsonb THEN NEW.payload := NEW.metadata; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_lead_event_sync ON public.lead_events;
CREATE TRIGGER trg_lead_event_sync BEFORE INSERT ON public.lead_events
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_event_cols();

-- ---------- conversations: lead-centric ----------
ALTER TABLE public.conversations ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id();
ALTER TABLE public.conversations ALTER COLUMN channel SET DEFAULT 'whatsapp';
ALTER TABLE public.conversations ALTER COLUMN status SET DEFAULT 'open'::public.conversation_status;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_preview text;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_lead_id_key ON public.conversations (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_tenant_last_msg_idx ON public.conversations (tenant_id, last_message_at DESC);

-- ---------- conversation_messages: conversation-centric ----------
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS conversation_messages_convo_idx ON public.conversation_messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_external_key ON public.conversation_messages (tenant_id, external_id) WHERE external_id IS NOT NULL;

-- Fill lead_id / conversation_id / sender automatically so either shape works.
CREATE OR REPLACE FUNCTION public.fill_conversation_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c_id uuid; l_id uuid;
BEGIN
  IF NEW.lead_id IS NULL AND NEW.conversation_id IS NOT NULL THEN
    SELECT lead_id INTO l_id FROM public.conversations WHERE id = NEW.conversation_id;
    NEW.lead_id := l_id;
  END IF;
  IF NEW.conversation_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT id INTO c_id FROM public.conversations WHERE lead_id = NEW.lead_id;
    IF c_id IS NULL THEN
      INSERT INTO public.conversations (tenant_id, lead_id, last_message_at)
      VALUES (NEW.tenant_id, NEW.lead_id, NEW.created_at) RETURNING id INTO c_id;
    END IF;
    NEW.conversation_id := c_id;
  END IF;
  IF NEW.direction = 'outbound' AND NEW.sender = 'customer' THEN
    NEW.sender := CASE WHEN NEW.is_auto THEN 'auto' ELSE 'agent' END;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_fill_conv_msg ON public.conversation_messages;
CREATE TRIGGER trg_fill_conv_msg BEFORE INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.fill_conversation_message();

-- ---------- whatsapp_webhook_events (durable inbox) ----------
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  event text NOT NULL,
  message_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_webhook_events_msg ON public.whatsapp_webhook_events (event, message_id) WHERE message_id IS NOT NULL;
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant select webhook events" ON public.whatsapp_webhook_events;
CREATE POLICY "tenant select webhook events" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

-- ---------- websites (public /s/<slug> business pages) ----------
CREATE TABLE IF NOT EXISTS public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  published boolean NOT NULL DEFAULT false,
  headline text NOT NULL DEFAULT '',
  subheadline text NOT NULL DEFAULT '',
  about text NOT NULL DEFAULT '',
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_text text NOT NULL DEFAULT 'Get a free quote on WhatsApp',
  accent text NOT NULL DEFAULT 'emerald',
  whatsapp_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS websites_tenant_key ON public.websites (tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.websites TO authenticated;
GRANT SELECT ON public.websites TO anon;
GRANT ALL ON public.websites TO service_role;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read published sites" ON public.websites;
CREATE POLICY "public read published sites" ON public.websites FOR SELECT TO anon USING (published = true);
DROP POLICY IF EXISTS "tenant select site" ON public.websites;
CREATE POLICY "tenant select site" ON public.websites FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "tenant insert site" ON public.websites;
CREATE POLICY "tenant insert site" ON public.websites FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "tenant update site" ON public.websites;
CREATE POLICY "tenant update site" ON public.websites FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "tenant delete site" ON public.websites;
CREATE POLICY "tenant delete site" ON public.websites FOR DELETE TO authenticated USING (public.is_tenant_member(tenant_id));
DROP TRIGGER IF EXISTS trg_websites_updated ON public.websites;
CREATE TRIGGER trg_websites_updated BEFORE UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- signup trigger: also stamp tenant owner ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_id uuid;
BEGIN
  INSERT INTO public.tenants (name, slug, owner_id)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1)),
          't-' || replace(NEW.id::text,'-',''), NEW.id)
  RETURNING id INTO t_id;
  INSERT INTO public.profiles (id, tenant_id, full_name, email)
  VALUES (NEW.id, t_id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), COALESCE(NEW.email,''));
  INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, t_id, 'owner') ON CONFLICT DO NOTHING;
  INSERT INTO public.business_profiles (tenant_id, business_name) VALUES (t_id, '') ON CONFLICT (tenant_id) DO NOTHING;
  INSERT INTO public.auto_reply_configs (tenant_id, questions)
  VALUES (t_id, '["What service do you need?","Which suburb are you in?","How urgent is it?"]'::jsonb)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- ---------- realtime ----------
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.business_profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;