-- Team seats: invite team members into a tenant workspace (unlimited seats on the base plan).
-- Additive only: existing owner-based policies are untouched; member policies are added alongside.

CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  business_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'agent',
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (tenant_id, email)
);

ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- Members of the tenant can see its invites.
DROP POLICY IF EXISTS "tenant read invites" ON public.tenant_invites;
CREATE POLICY "tenant read invites" ON public.tenant_invites FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- The invited person can see (and accept) invites addressed to their own email.
DROP POLICY IF EXISTS "invitee read own invites" ON public.tenant_invites;
CREATE POLICY "invitee read own invites" ON public.tenant_invites FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "invitee accept own invite" ON public.tenant_invites;
CREATE POLICY "invitee accept own invite" ON public.tenant_invites FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) AND accepted_at IS NULL)
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Owners/admins manage invites (server functions use the service role; this covers direct client calls).
DROP POLICY IF EXISTS "admins manage invites" ON public.tenant_invites;
CREATE POLICY "admins manage invites" ON public.tenant_invites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tenant_invites.tenant_id AND ur.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.tenant_id = tenant_invites.tenant_id AND ur.role IN ('owner','admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invites TO authenticated;

-- Additive member policies for the core workspace tables so invited team members can work the inbox.
-- These are OR-ed with whatever owner-based policies already exist; nothing existing is dropped.
DROP POLICY IF EXISTS "team members access leads" ON public.leads;
CREATE POLICY "team members access leads" ON public.leads FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "team members access lead events" ON public.lead_events;
CREATE POLICY "team members access lead events" ON public.lead_events FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "team members access conversation messages" ON public.conversation_messages;
CREATE POLICY "team members access conversation messages" ON public.conversation_messages FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "team members read business profiles" ON public.business_profiles;
CREATE POLICY "team members read business profiles" ON public.business_profiles FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "team members update business profiles" ON public.business_profiles;
CREATE POLICY "team members update business profiles" ON public.business_profiles FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "team members read auto reply configs" ON public.auto_reply_configs;
CREATE POLICY "team members read auto reply configs" ON public.auto_reply_configs FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
