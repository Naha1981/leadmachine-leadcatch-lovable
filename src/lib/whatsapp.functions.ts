import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ensureOperatorTenantCredential,
  operatorRequest,
  sendText,
} from "./operator.server";

async function loadTenant(supabase: any, userId: string) {
  const { data: tenant, error } = await supabase.from("tenants").select("id").eq("owner_id", userId).single();
  if (error || !tenant) throw new Error("Workspace not found");
  const { data: profile } = await supabase.from("business_profiles").select("*").eq("tenant_id", tenant.id).single();
  return { tenantId: tenant.id as string, profile };
}

function mapStatus(s: string | undefined) {
  if (s === "connected" || s === "open") return "connected";
  if (s === "qr_ready" || s === "pairing_code_ready" || s === "connecting") return "connecting";
  return "disconnected";
}

/** Create/bind the Operator account for this tenant and start a session. */
export const connectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId } = await loadTenant(context.supabase, context.userId);
    const origin = new URL(getRequest().url).origin;
    const webhookUrl = origin + "/api/public/whatsapp/webhook";
    const boot = await operatorRequest<{ waAccountId: string; status: string; tenantToken?: string }>(
      tenantId,
      "/accounts/bootstrap",
      {
        method: "POST",
        body: JSON.stringify({ label: "LeadMachine", appId: "leadcatch-sa", tenantId, webhookUrl }),
      },
      { auth: "platform" },
    );

    await ensureOperatorTenantCredential(tenantId, boot.waAccountId, boot.tenantToken);

    if (boot.status !== "connected") {
      await operatorRequest(tenantId, "/accounts/" + encodeURIComponent(boot.waAccountId) + "/connect", { method: "POST" }).catch(() => null);
    }

    await context.supabase
      .from("business_profiles")
      .update({ wa_account_id: boot.waAccountId, whatsapp_status: mapStatus(boot.status), updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);
    return { waAccountId: boot.waAccountId, status: mapStatus(boot.status) };
  });

/** Poll session status and QR code. */
export const getWhatsAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId, profile } = await loadTenant(context.supabase, context.userId);
    const id = profile?.wa_account_id;
    if (!id) return { status: "disconnected", qrCode: null as string | null, phone: null as string | null };
    const st = await operatorRequest<any>(tenantId, "/accounts/" + encodeURIComponent(id) + "/status");
    let qrCode: string | null = null;
    const status = mapStatus(st.status ?? (st.isConnected ? "connected" : undefined));
    if (status !== "connected") {
      const qr = await operatorRequest<any>(tenantId, "/accounts/" + encodeURIComponent(id) + "/qr").catch(() => null);
      qrCode = qr?.qrCode ?? null;
    }
    const phone = st.phoneNumber ?? st.phone ?? profile?.whatsapp_number ?? null;
    await context.supabase
      .from("business_profiles")
      .update({
        whatsapp_status: status,
        whatsapp_number: phone,
        ...(status === "connected" ? { whatsapp_last_synced_at: new Date().toISOString() } : {}),
      })
      .eq("tenant_id", tenantId);
    return { status, qrCode, phone };
  });

export const requestPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phoneNumber: z.string().regex(/^\+?\d{9,15}$/) }).parse(d))
  .handler(async ({ context, data }) => {
    const { tenantId, profile } = await loadTenant(context.supabase, context.userId);
    if (!profile?.wa_account_id) throw new Error("Start the connection first");
    const r = await operatorRequest<any>(tenantId, "/accounts/" + encodeURIComponent(profile.wa_account_id) + "/pairing-code", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: data.phoneNumber.replace(/\D/g, "") }),
    });
    return { code: (r.pairingCode ?? r.code ?? null) as string | null };
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tenantId, profile } = await loadTenant(context.supabase, context.userId);
    if (profile?.wa_account_id) {
      await operatorRequest(tenantId, "/accounts/" + encodeURIComponent(profile.wa_account_id) + "/disconnect", { method: "POST" }).catch(() => null);
    }
    await context.supabase.from("business_profiles").update({ whatsapp_status: "disconnected" }).eq("tenant_id", tenantId);
    return { ok: true };
  });

/** Send a manual reply from the inbox. */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { tenantId, profile } = await loadTenant(sb, context.userId);
    const { data: convo, error } = await sb
      .from("conversations")
      .select("id, lead_id, leads(phone, status)")
      .eq("id", data.conversationId)
      .single();
    if (error || !convo || !convo.lead_id) throw new Error("Conversation not found");
    const leadId = convo.lead_id;
    const lead = (convo as any).leads;
    const { data: msg } = await sb
      .from("conversation_messages")
      .insert({ tenant_id: tenantId, conversation_id: convo.id, lead_id: leadId, direction: "outbound", body: data.body, sender: "agent", delivery_status: "pending" })
      .select("id")
      .single();
    let status = "failed";
    let errorMsg: string | null = null;
    try {
      if (!profile?.wa_account_id) throw new Error("WhatsApp is not connected");
      const r = await sendText(tenantId, profile.wa_account_id, lead.phone, data.body);
      status = "sent";
      await sb.from("conversation_messages").update({ delivery_status: "sent", external_id: r.message?.key?.id ?? null }).eq("id", msg!.id);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Send failed";
      await sb.from("conversation_messages").update({ delivery_status: "failed" }).eq("id", msg!.id);
    }
    const now = new Date().toISOString();
    await sb.from("conversations").update({ last_message_preview: data.body, last_message_at: now, unread_count: 0 }).eq("id", convo.id);
    if (status === "sent") {
      if (lead.status === "new") await sb.from("leads").update({ status: "replied", updated_at: now }).eq("id", leadId);
      await sb.from("lead_events").insert({ tenant_id: tenantId, lead_id: leadId, type: "reply_sent", payload: { manual: true } });
    }
    return { status, error: errorMsg };
  });
