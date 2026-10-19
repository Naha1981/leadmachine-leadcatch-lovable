-- Booking slots + bookings, 7-day trial, manual EFT billing.
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial','active','expired')),
  ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE TABLE IF NOT EXISTS public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','booked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, starts_at)
);
CREATE INDEX IF NOT EXISTS availability_slots_tenant_idx ON public.availability_slots (tenant_id, status, starts_at);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.availability_slots(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT 'Potential Customer',
  customer_phone text,
  service text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_tenant_idx ON public.bookings (tenant_id, starts_at);

ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_slots, public.bookings TO authenticated;
GRANT ALL ON public.availability_slots, public.bookings TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant manage slots" ON public.availability_slots;
CREATE POLICY "tenant manage slots" ON public.availability_slots FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "tenant manage bookings" ON public.bookings;
CREATE POLICY "tenant manage bookings" ON public.bookings FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
