import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];
export type Campaign = Tables["campaigns"]["Row"];
export type Contact = Tables["contacts"]["Row"];
export type Policy = Tables["policies"]["Row"];
export type Payment = Tables["payments"]["Row"];
export type Conversation = Tables["conversations"]["Row"];
export type Message = Tables["messages"]["Row"];
export type DemandSignal = Tables["demand_signals"]["Row"];
export type ContentOpportunity = Tables["content_opportunities"]["Row"];
export type ImportRow = Tables["imports"]["Row"];
export type LeakageRecord = Tables["leakage_records"]["Row"];
export type Integration = Tables["integrations"]["Row"];
export type Profile = Tables["profiles"]["Row"];

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

export const profileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, tenants(name, slug, currency)")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const campaignsQuery = () =>
  queryOptions({
    queryKey: ["campaigns"],
    queryFn: async () =>
      unwrap<Campaign[]>(
        await supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      ),
  });

export const contactsQuery = () =>
  queryOptions({
    queryKey: ["contacts"],
    queryFn: async () =>
      unwrap<Contact[]>(
        await supabase
          .from("contacts")
          .select("*")
          .order("recovery_score", { ascending: false })
          .limit(500),
      ),
  });

export const policiesQuery = () =>
  queryOptions({
    queryKey: ["policies"],
    queryFn: async () =>
      unwrap<(Policy & { contacts: { full_name: string } | null })[]>(
        await supabase
          .from("policies")
          .select("*, contacts(full_name)")
          .order("created_at", { ascending: false })
          .limit(500),
      ),
  });

export const paymentsQuery = () =>
  queryOptions({
    queryKey: ["payments"],
    queryFn: async () =>
      unwrap<(Payment & { contacts: { full_name: string } | null })[]>(
        await supabase
          .from("payments")
          .select("*, contacts(full_name)")
          .order("created_at", { ascending: false })
          .limit(500),
      ),
  });

export const conversationsQuery = () =>
  queryOptions({
    queryKey: ["conversations"],
    queryFn: async () =>
      unwrap<(Conversation & { contacts: { full_name: string; phone: string | null } | null })[]>(
        await supabase
          .from("conversations")
          .select("*, contacts(full_name, phone)")
          .order("last_message_at", { ascending: false })
          .limit(200),
      ),
  });

export const messagesQuery = (conversationId: string | undefined) =>
  queryOptions({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () =>
      unwrap<Message[]>(
        await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId!)
          .order("created_at", { ascending: true }),
      ),
  });

export const signalsQuery = () =>
  queryOptions({
    queryKey: ["demand_signals"],
    queryFn: async () =>
      unwrap<DemandSignal[]>(
        await supabase
          .from("demand_signals")
          .select("*")
          .order("frequency", { ascending: false }),
      ),
  });

export const opportunitiesQuery = () =>
  queryOptions({
    queryKey: ["content_opportunities"],
    queryFn: async () =>
      unwrap<ContentOpportunity[]>(
        await supabase
          .from("content_opportunities")
          .select("*")
          .order("occurrences", { ascending: false }),
      ),
  });

export const importsQuery = () =>
  queryOptions({
    queryKey: ["imports"],
    queryFn: async () =>
      unwrap<ImportRow[]>(
        await supabase.from("imports").select("*").order("created_at", { ascending: false }),
      ),
  });

export const leakageQuery = () =>
  queryOptions({
    queryKey: ["leakage"],
    queryFn: async () =>
      unwrap<LeakageRecord[]>(
        await supabase
          .from("leakage_records")
          .select("*")
          .order("amount_cents", { ascending: false }),
      ),
  });

export const integrationsQuery = () =>
  queryOptions({
    queryKey: ["integrations"],
    queryFn: async () =>
      unwrap<Integration[]>(
        await supabase.from("integrations").select("*").order("provider", { ascending: true }),
      ),
  });