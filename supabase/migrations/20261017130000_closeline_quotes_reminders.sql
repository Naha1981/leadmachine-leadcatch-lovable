-- Closeline core: quote tracking with chase flags + recurring-service reminders.
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  title text NOT NULL DEFAULT '',
  amount_cents bigint NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','won','lost')),
  sent_on date NOT NULL DEFAULT current_date,
  follow_up_on date NOT NULL DEFAULT (current_date + 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_tenant_status_idx
  ON public.quotes (tenant_id, status, follow_up_on);

CREATE TABLE IF NOT EXISTS public.service_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  service_every_days int CHECK (service_every_days IS NULL OR service_every_days BETWEEN 1 AND 730),
  monthly_value_cents bigint CHECK (monthly_value_cents IS NULL OR monthly_value_cents >= 0),
  last_service_on date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_customers_tenant_idx
  ON public.service_customers (tenant_id, name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_customers TO authenticated;
GRANT ALL ON public.quotes TO service_role;
GRANT ALL ON public.service_customers TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant manage quotes" ON public.quotes;
CREATE POLICY "tenant manage quotes"
  ON public.quotes
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant manage service customers" ON public.service_customers;
CREATE POLICY "tenant manage service customers"
  ON public.service_customers
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));
