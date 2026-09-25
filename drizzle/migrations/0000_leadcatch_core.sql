
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

CREATE TYPE public.lead_status AS ENUM ('new','replied','qualified','quoted','won','lost');
CREATE TYPE public.action_status AS ENUM ('pending','processing','done','failed');

CREATE TABLE public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  trade text NOT NULL DEFAULT '',
  contact_phone text,
  suburb text,
  working_hours jsonb NOT NULL DEFAULT '{"days":[1,2,3,4,5],"start":"08:00","end":"17:00"}'::jsonb,
  services text NOT NULL DEFAULT '',
  pricing_notes text NOT NULL DEFAULT '',
  brand_voice text NOT NULL DEFAULT 'Friendly and professional',
  whatsapp_number text,
  whatsapp_status text NOT NULL DEFAULT 'disconnected' CHECK (whatsapp_status IN ('connected','disconnected','connecting')),
  whatsapp_last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read business profile" ON public.business_profiles FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members insert business profile" ON public.business_profiles FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "members update business profile" ON public.business_profiles FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE TRIGGER trg_bp_updated BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.auto_reply_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  greeting text NOT NULL DEFAULT 'Hi! Thanks for contacting us. We''ll help you right away.',
  qualification_questions text[] NOT NULL DEFAULT ARRAY['What do you need help with?','Which suburb are you in?','How urgent is it?'],
  after_hours_message text NOT NULL DEFAULT 'Thanks for your message. We''re closed right now and will reply first thing tomorrow.',
  handoff_message text NOT NULL DEFAULT 'Thanks! One of our team will reply to you shortly.',
  review_request_message text NOT NULL DEFAULT 'Thanks for choosing us! Would you mind leaving us a quick review?',
  review_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.auto_reply_configs TO authenticated;
GRANT ALL ON public.auto_reply_configs TO service_role;
ALTER TABLE public.auto_reply_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read auto reply" ON public.auto_reply_configs FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members insert auto reply" ON public.auto_reply_configs FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "members update auto reply" ON public.auto_reply_configs FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE TRIGGER trg_arc_updated BEFORE UPDATE ON public.auto_reply_configs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  source text NOT NULL DEFAULT 'whatsapp',
  status public.lead_status NOT NULL DEFAULT 'new',
  service text,
  suburb text,
  urgency text CHECK (urgency IN ('low','normal','high','emergency')),
  estimated_value_cents bigint,
  actual_revenue_cents bigint,
  notes text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  first_response_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);
CREATE INDEX leads_tenant_created_idx ON public.leads (tenant_id, created_at DESC);
CREATE INDEX leads_tenant_status_idx ON public.leads (tenant_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read leads" ON public.leads FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "members update leads" ON public.leads FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "members delete leads" ON public.leads FOR DELETE TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX lead_events_lead_idx ON public.lead_events (lead_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read lead events" ON public.lead_events FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members insert lead events" ON public.lead_events FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));

CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  body text NOT NULL,
  sender text NOT NULL DEFAULT 'customer' CHECK (sender IN ('customer','auto','agent')),
  delivery_status text NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued','sent','delivered','read','failed','received')),
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conv_msgs_lead_idx ON public.conversation_messages (lead_id, created_at);
GRANT SELECT, INSERT ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read messages" ON public.conversation_messages FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members insert outbound" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id) AND direction = 'outbound');

CREATE TABLE public.pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('send_message','send_quote','send_review_request','send_test_message')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.action_status NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX pending_actions_status_idx ON public.pending_actions (status, created_at);
GRANT SELECT, INSERT ON public.pending_actions TO authenticated;
GRANT ALL ON public.pending_actions TO service_role;
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read actions" ON public.pending_actions FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members queue actions" ON public.pending_actions FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id) AND status = 'pending');

-- Event sourcing + denormalised lead timestamps
CREATE OR REPLACE FUNCTION public.log_lead_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_events (tenant_id, lead_id, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, 'lead_created', auth.uid(), jsonb_build_object('source', NEW.source));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_events (tenant_id, lead_id, event_type, actor_id, metadata)
    VALUES (NEW.tenant_id, NEW.id, 'status_changed', auth.uid(), jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_leads_events AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_lead_change();

CREATE OR REPLACE FUNCTION public.on_conversation_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'outbound' THEN
    UPDATE public.leads SET last_message_at = NEW.created_at,
      first_response_at = COALESCE(first_response_at, NEW.created_at),
      status = CASE WHEN status = 'new' THEN 'replied'::public.lead_status ELSE status END
    WHERE id = NEW.lead_id;
  ELSE
    UPDATE public.leads SET last_message_at = NEW.created_at WHERE id = NEW.lead_id;
  END IF;
  INSERT INTO public.lead_events (tenant_id, lead_id, event_type, actor_id, metadata)
  VALUES (NEW.tenant_id, NEW.lead_id, 'message_' || NEW.direction::text, auth.uid(), jsonb_build_object('sender', NEW.sender, 'message_id', NEW.id));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_conv_msg AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.on_conversation_message();

-- New signups get their own empty tenant; onboarding fills it in
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_id uuid;
BEGIN
  INSERT INTO public.tenants (name, slug)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1)), 't-' || replace(NEW.id::text,'-',''))
  RETURNING id INTO t_id;
  INSERT INTO public.profiles (id, tenant_id, full_name, email)
  VALUES (NEW.id, t_id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), COALESCE(NEW.email,''));
  INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, t_id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_business_name text, p_trade text, p_contact_phone text, p_suburb text,
  p_start text DEFAULT '08:00', p_end text DEFAULT '17:00')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t_id uuid; is_done boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(coalesce(p_business_name,''))) < 2 THEN RAISE EXCEPTION 'Business name is required'; END IF;
  SELECT p.tenant_id, t.onboarded INTO t_id, is_done FROM public.profiles p JOIN public.tenants t ON t.id = p.tenant_id WHERE p.id = uid;
  IF t_id IS NULL OR t_id = '11111111-1111-1111-1111-111111111111' THEN
    INSERT INTO public.tenants (name, slug) VALUES (trim(p_business_name), 't-' || replace(gen_random_uuid()::text,'-','')) RETURNING id INTO t_id;
    UPDATE public.profiles SET tenant_id = t_id WHERE id = uid;
    INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (uid, t_id, 'owner') ON CONFLICT DO NOTHING;
    is_done := false;
  END IF;
  IF is_done THEN RETURN t_id; END IF;
  UPDATE public.tenants SET name = trim(p_business_name), onboarded = true WHERE id = t_id;
  INSERT INTO public.business_profiles (tenant_id, business_name, trade, contact_phone, suburb, working_hours)
  VALUES (t_id, trim(p_business_name), coalesce(p_trade,''), p_contact_phone, p_suburb,
    jsonb_build_object('days', jsonb_build_array(1,2,3,4,5), 'start', p_start, 'end', p_end))
  ON CONFLICT (tenant_id) DO UPDATE SET business_name = EXCLUDED.business_name, trade = EXCLUDED.trade,
    contact_phone = EXCLUDED.contact_phone, suburb = EXCLUDED.suburb, working_hours = EXCLUDED.working_hours;
  INSERT INTO public.auto_reply_configs (tenant_id, greeting)
  VALUES (t_id, 'Hi! Thanks for contacting ' || trim(p_business_name) || '. We''ll help you right away.')
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN t_id;
END; $$;
REVOKE ALL ON FUNCTION public.complete_onboarding(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text,text,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.log_lead_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_conversation_message() FROM PUBLIC, anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads, public.conversation_messages;

COMMENT ON TABLE public.campaigns IS 'DEPRECATED: 2ndLife recovery-engine UI removed in LeadCatch SA sprint 1';
COMMENT ON TABLE public.contacts IS 'DEPRECATED: replaced by leads';
COMMENT ON TABLE public.policies IS 'DEPRECATED: 2ndLife recovery-engine';
COMMENT ON TABLE public.payments IS 'DEPRECATED: 2ndLife recovery-engine';
COMMENT ON TABLE public.messages IS 'DEPRECATED: replaced by conversation_messages';
COMMENT ON TABLE public.demand_signals IS 'DEPRECATED: 2ndLife demand radar';
COMMENT ON TABLE public.content_opportunities IS 'DEPRECATED: 2ndLife content engine';
COMMENT ON TABLE public.imports IS 'DEPRECATED';
COMMENT ON TABLE public.leakage_records IS 'DEPRECATED';
COMMENT ON TABLE public.integrations IS 'DEPRECATED';
