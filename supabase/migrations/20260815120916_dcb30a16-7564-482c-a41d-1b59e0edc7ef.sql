
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('owner','admin','agent','viewer');
CREATE TYPE public.lifecycle_stage AS ENUM ('lead','active','at_risk','dormant','lapsed','recovered','churned');
CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','running','paused','completed');
CREATE TYPE public.conversation_status AS ENUM ('open','waiting','escalated','closed');
CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
CREATE TYPE public.payment_status AS ENUM ('pending','verified','failed','refunded');
CREATE TYPE public.signal_status AS ENUM ('new','watching','opportunity','archived');
CREATE TYPE public.import_status AS ENUM ('pending','processing','completed','failed');
CREATE TYPE public.confidence_level AS ENUM ('high','medium','estimated');

-- ========== TENANTS ==========
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  industry text NOT NULL DEFAULT 'funeral_insurance',
  currency text NOT NULL DEFAULT 'ZAR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT 'Administrator',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ========== HELPERS ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id = _tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ========== CORE DATA ==========
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  lifecycle_stage public.lifecycle_stage NOT NULL DEFAULT 'lead',
  recovery_score int NOT NULL DEFAULT 0,
  value_cents bigint NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'import',
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_tenant_stage ON public.contacts(tenant_id, lifecycle_stage);
CREATE INDEX idx_contacts_tenant_score ON public.contacts(tenant_id, recovery_score DESC);
CREATE INDEX idx_contacts_phone ON public.contacts(tenant_id, phone);

CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  policy_number text NOT NULL,
  product text NOT NULL DEFAULT 'Funeral Insurance',
  premium_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'lapsed',
  lapsed_at date,
  next_due_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_policies_tenant ON public.policies(tenant_id, status);

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  product text NOT NULL DEFAULT 'Funeral Insurance',
  status public.campaign_status NOT NULL DEFAULT 'draft',
  audience text NOT NULL DEFAULT 'Lapsed policies',
  sent int NOT NULL DEFAULT 0,
  engaged int NOT NULL DEFAULT 0,
  payments int NOT NULL DEFAULT 0,
  revenue_cents bigint NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_tenant ON public.campaigns(tenant_id, created_at DESC);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  status public.conversation_status NOT NULL DEFAULT 'open',
  intent text,
  unread_count int NOT NULL DEFAULT 0,
  assigned_to uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id, last_message_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  body text NOT NULL,
  sender text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'ozow',
  status public.payment_status NOT NULL DEFAULT 'pending',
  reference text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_payments_reference ON public.payments(tenant_id, reference);
CREATE INDEX idx_payments_tenant_status ON public.payments(tenant_id, status, created_at DESC);

CREATE TABLE public.demand_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  topic text NOT NULL,
  source text NOT NULL DEFAULT 'faq',
  frequency int NOT NULL DEFAULT 1,
  intent_score int NOT NULL DEFAULT 0,
  status public.signal_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_signals_tenant ON public.demand_signals(tenant_id, status, frequency DESC);

CREATE TABLE public.content_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signal_id uuid REFERENCES public.demand_signals(id) ON DELETE SET NULL,
  topic text NOT NULL,
  hook text NOT NULL,
  cta text NOT NULL,
  formats text[] NOT NULL DEFAULT '{}',
  occurrences int NOT NULL DEFAULT 3,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_opportunities_tenant ON public.content_opportunities(tenant_id, created_at DESC);

CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  filename text NOT NULL,
  row_count int NOT NULL DEFAULT 0,
  imported_count int NOT NULL DEFAULT 0,
  status public.import_status NOT NULL DEFAULT 'pending',
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_imports_tenant ON public.imports(tenant_id, created_at DESC);

CREATE TABLE public.leakage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stage text NOT NULL,
  amount_cents bigint NOT NULL DEFAULT 0,
  item_count int NOT NULL DEFAULT 0,
  confidence public.confidence_level NOT NULL DEFAULT 'high',
  period_start date NOT NULL DEFAULT (now()::date - 7),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leakage_tenant ON public.leakage_records(tenant_id, period_start DESC);

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- ========== GRANTS ==========
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants, public.profiles, public.contacts, public.policies,
  public.campaigns, public.conversations, public.messages, public.payments, public.demand_signals,
  public.content_opportunities, public.imports, public.leakage_records, public.integrations TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.tenants, public.profiles, public.user_roles, public.contacts, public.policies,
  public.campaigns, public.conversations, public.messages, public.payments, public.demand_signals,
  public.content_opportunities, public.imports, public.leakage_records, public.integrations TO service_role;

-- ========== RLS ==========
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leakage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant readable by members" ON public.tenants FOR SELECT TO authenticated USING (public.is_tenant_member(id));
CREATE POLICY "tenant updatable by admins" ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_tenant_member(id) AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_tenant_member(id));

CREATE POLICY "profiles readable by tenant" ON public.profiles FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles readable by self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "contacts tenant access" ON public.contacts FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "policies tenant access" ON public.policies FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "campaigns tenant access" ON public.campaigns FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "conversations tenant access" ON public.conversations FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "messages tenant access" ON public.messages FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "payments tenant access" ON public.payments FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "signals tenant access" ON public.demand_signals FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "opportunities tenant access" ON public.content_opportunities FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "imports tenant access" ON public.imports FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "leakage tenant access" ON public.leakage_records FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "integrations tenant access" ON public.integrations FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

-- ========== TRIGGERS ==========
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_id uuid;
BEGIN
  SELECT id INTO t_id FROM public.tenants WHERE slug = 'funeral-secure' LIMIT 1;
  IF t_id IS NULL THEN
    INSERT INTO public.tenants (name, slug) VALUES ('Funeral Secure Admin','funeral-secure') RETURNING id INTO t_id;
  END IF;
  INSERT INTO public.profiles (id, tenant_id, full_name, email)
  VALUES (NEW.id, t_id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), COALESCE(NEW.email,''));
  INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES (NEW.id, t_id, 'owner') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== SEED DEMO TENANT ==========
INSERT INTO public.tenants (id, name, slug) VALUES ('11111111-1111-1111-1111-111111111111','Funeral Secure Admin','funeral-secure');

INSERT INTO public.campaigns (id, tenant_id, name, product, status, sent, engaged, payments, revenue_cents, created_at) VALUES
 ('22222222-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','May Reactivation','Funeral Insurance','completed',10000,4320,1256,67824000,'2025-05-01'),
 ('22222222-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','April Follow-up','Funeral Insurance','completed',8000,3210,890,45678000,'2025-04-01'),
 ('22222222-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Mar Win-back','Funeral Insurance','completed',7500,2890,745,34512000,'2025-03-01'),
 ('22222222-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','June Dormant Sweep','Funeral Insurance','running',4200,1180,312,14980000,now());

INSERT INTO public.contacts (id, tenant_id, full_name, phone, email, lifecycle_stage, recovery_score, value_cents, source, last_activity_at) VALUES
 ('33333333-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Thabo Mokoena','+27821234567','thabo@example.co.za','dormant',87,480000,'import', now() - interval '2 days'),
 ('33333333-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Sipho Dlamini','+27827654321','sipho@example.co.za','lapsed',91,360000,'import', now() - interval '1 day'),
 ('33333333-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Nandi Khumalo','+27835551234','nandi@example.co.za','at_risk',74,290000,'whatsapp', now() - interval '5 hours'),
 ('33333333-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Lerato Mahlangu','+27845559876','lerato@example.co.za','recovered',65,520000,'campaign', now() - interval '3 days'),
 ('33333333-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Johan van Wyk','+27812223344','johan@example.co.za','lead',58,150000,'website', now() - interval '9 hours');

INSERT INTO public.policies (tenant_id, contact_id, policy_number, premium_cents, status, lapsed_at, next_due_at) VALUES
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000001','FS-100231',45000,'lapsed','2025-01-15',NULL),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000002','FS-100544',36000,'lapsed','2025-02-02',NULL),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000003','FS-100877',29000,'active',NULL,'2025-09-01'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000004','FS-101002',52000,'active',NULL,'2025-08-28');

INSERT INTO public.conversations (id, tenant_id, contact_id, status, intent, unread_count, last_message_at) VALUES
 ('44444444-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000001','open','restart_policy',2, now() - interval '12 minutes'),
 ('44444444-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000002','waiting','pricing',1, now() - interval '1 hour'),
 ('44444444-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000003','escalated','complaint',3, now() - interval '4 hours');

INSERT INTO public.messages (tenant_id, conversation_id, direction, body, sender, created_at) VALUES
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001','outbound','Hi Thabo, your cover lapsed in Jan. You don''t owe arrears. Want to restart for R150/mo?','ai', now() - interval '30 minutes'),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000001','inbound','Yes, let''s do it','contact', now() - interval '12 minutes'),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000002','outbound','Hi Sipho, we can reinstate your funeral cover today at R120/mo. Shall I send the link?','ai', now() - interval '2 hours'),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000002','inbound','How much is the family plan?','contact', now() - interval '1 hour'),
 ('11111111-1111-1111-1111-111111111111','44444444-0000-0000-0000-000000000003','inbound','I was debited twice last month','contact', now() - interval '4 hours');

INSERT INTO public.payments (tenant_id, contact_id, campaign_id, amount_cents, provider, status, reference, verified_at, created_at) VALUES
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001',15000,'ozow','verified','OZW-88213', now() - interval '2 days', now() - interval '2 days'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001',52000,'ozow','verified','OZW-88240', now() - interval '3 days', now() - interval '3 days'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000004',12000,'stripe','pending','STR-41190',NULL, now() - interval '4 hours'),
 ('11111111-1111-1111-1111-111111111111','33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000004',29000,'ozow','failed','OZW-88301',NULL, now() - interval '1 day');

INSERT INTO public.demand_signals (id, tenant_id, topic, source, frequency, intent_score, status) VALUES
 ('55555555-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','invisalign vs braces','faq',2,65,'new'),
 ('55555555-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','laser hair removal price','tiktok',5,88,'opportunity'),
 ('55555555-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','teeth whitening sandton','google_reviews',3,79,'opportunity');

INSERT INTO public.content_opportunities (tenant_id, signal_id, topic, hook, cta, formats, occurrences, evidence) VALUES
 ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000002','laser hair removal price','The truth about laser hair removal price','WhatsApp us for a free consultation','{reel,carousel,seo_article}',5,
  '[{"source":"tiktok","quote":"How much does laser hair removal cost? 1"},{"source":"tiktok","quote":"How much does laser hair removal cost? 2"}]'::jsonb),
 ('11111111-1111-1111-1111-111111111111','55555555-0000-0000-0000-000000000003','teeth whitening sandton','The truth about teeth whitening sandton','WhatsApp us for a free consultation','{reel,carousel,seo_article}',3,
  '[{"source":"google_reviews","quote":"Best teeth whitening in Sandton? 1"},{"source":"google_reviews","quote":"Best teeth whitening in Sandton? 2"}]'::jsonb);

INSERT INTO public.leakage_records (tenant_id, stage, amount_cents, item_count, confidence) VALUES
 ('11111111-1111-1111-1111-111111111111','Slow response',1840000,23,'high'),
 ('11111111-1111-1111-1111-111111111111','Unanswered leads',1120000,14,'high'),
 ('11111111-1111-1111-1111-111111111111','No-shows',780000,9,'medium'),
 ('11111111-1111-1111-1111-111111111111','Abandoned quotes',1570000,18,'estimated');

INSERT INTO public.integrations (tenant_id, provider, status) VALUES
 ('11111111-1111-1111-1111-111111111111','whatsapp','connected'),
 ('11111111-1111-1111-1111-111111111111','ozow','connected'),
 ('11111111-1111-1111-1111-111111111111','stripe','disconnected'),
 ('11111111-1111-1111-1111-111111111111','meta_capi','disconnected'),
 ('11111111-1111-1111-1111-111111111111','google_ads','disconnected');

INSERT INTO public.imports (tenant_id, filename, row_count, imported_count, status) VALUES
 ('11111111-1111-1111-1111-111111111111','lapsed_policies_may.csv',10000,9842,'completed'),
 ('11111111-1111-1111-1111-111111111111','dormant_customers_q2.csv',4200,4200,'completed');
