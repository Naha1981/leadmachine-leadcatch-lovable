-- Simulated Potential Customer messages use delivery_status='simulated'.
ALTER TABLE public.conversation_messages DROP CONSTRAINT conversation_messages_delivery_status_check;
ALTER TABLE public.conversation_messages ADD CONSTRAINT conversation_messages_delivery_status_check
  CHECK (delivery_status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'received'::text, 'simulated'::text]));
