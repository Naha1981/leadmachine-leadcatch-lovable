import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Lead = T["leads"]["Row"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type ConversationMessage = T["conversation_messages"]["Row"];
export type LeadEvent = T["lead_events"]["Row"];
export type BusinessProfile = T["business_profiles"]["Row"];
export type AutoReplyConfig = T["auto_reply_configs"]["Row"];
export type PendingAction = T["pending_actions"]["Row"];

export const LEAD_STATUSES: LeadStatus[] = ["new", "replied", "qualified", "quoted", "won", "lost"];

function check<D>(r: { data: D | null; error: { message: string } | null }): D {
  if (r.error) throw new Error(r.error.message);
  return r.data as D;
}

export const workspaceQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["workspace", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const profile = check(
        await supabase
          .from("profiles")
          .select("id, full_name, email, tenant_id, tenants(id, name, onboarded)")
          .eq("id", userId!)
          .maybeSingle(),
      );
      return profile;
    },
  });

export const businessProfileQuery = () =>
  queryOptions({
    queryKey: ["business_profile"],
    queryFn: async () =>
      check(await supabase.from("business_profiles").select("*").maybeSingle()),
  });

export const autoReplyQuery = () =>
  queryOptions({
    queryKey: ["auto_reply"],
    queryFn: async () =>
      check(await supabase.from("auto_reply_configs").select("*").maybeSingle()),
  });

export const leadsQuery = () =>
  queryOptions({
    queryKey: ["leads"],
    queryFn: async () =>
      check(
        await supabase
          .from("leads")
          .select("*")
          .order("last_message_at", { ascending: false })
          .limit(300),
      ),
  });

export const leadQuery = (id: string) =>
  queryOptions({
    queryKey: ["lead", id],
    queryFn: async () => check(await supabase.from("leads").select("*").eq("id", id).maybeSingle()),
  });

export const messagesQuery = (leadId: string) =>
  queryOptions({
    queryKey: ["messages", leadId],
    queryFn: async () =>
      check(
        await supabase
          .from("conversation_messages")
          .select("*")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: true })
          .limit(500),
      ),
  });

export const needsReply = (lead: Lead) =>
  lead.status === "new" && lead.first_response_at === null;

/** Queue an outbound WhatsApp message: stored message + pending action for the external connector. */
export async function queueMessage(opts: {
  leadId: string;
  phone: string;
  body: string;
  actionType?: "send_message" | "send_quote" | "send_review_request";
  extra?: Record<string, unknown>;
}) {
  const msg = check(
    await supabase
      .from("conversation_messages")
      .insert({ lead_id: opts.leadId, direction: "outbound", sender: "agent", body: opts.body })
      .select("id")
      .single(),
  );
  check(
    await supabase.from("pending_actions").insert({
      action_type: opts.actionType ?? "send_message",
      lead_id: opts.leadId,
      message_id: msg.id,
      payload: { to: opts.phone, body: opts.body, ...(opts.extra ?? {}) },
    }),
  );
  return msg.id;
}
