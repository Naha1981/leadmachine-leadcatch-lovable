-- Simulated "Potential Customer" enquiries: let a tenant member insert the simulated
-- INBOUND message (real inbound WhatsApp messages arrive via the service role).
DROP POLICY IF EXISTS "members insert inbound sim" ON public.conversation_messages;
CREATE POLICY "members insert inbound sim" ON public.conversation_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id) AND direction = 'inbound'::message_direction AND delivery_status = 'simulated');
