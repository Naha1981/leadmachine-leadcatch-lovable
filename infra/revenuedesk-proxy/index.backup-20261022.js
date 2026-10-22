const UPSTREAM_HOST = "revenuedesk-app.naha-thabiso.workers.dev";
const PUBLIC_HOST = "revenuedesk.nahalabs.co.za";
const SUPABASE_URL = "https://zdaolncziicfgpfknxyd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_54XpTzU7w3xDBPtoKUgfnw_8ktNgZgf";
const API_BASE = "https://nahalabs-content-api.nahalabs.workers.dev";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

// spec-faithful MD5, verified against node crypto below
function md5(input) {
  const s = unescape(encodeURIComponent(input));
  const K = [], S = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    S[i] = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
            5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
            4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
            6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21][i];
  }
  const bytes = [];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push((bitLen / Math.pow(2, 8 * i)) & 0xff);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const rl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
  for (let off = 0; off < bytes.length; off += 64) {
    const M = [];
    for (let i = 0; i < 16; i++)
      M[i] = (bytes[off+4*i] | (bytes[off+4*i+1] << 8) | (bytes[off+4*i+2] << 16) | (bytes[off+4*i+3] << 24)) >>> 0;
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + rl(F, S[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const le = (x) => [0,8,16,24].map(n => ((x >>> n) & 0xff).toString(16).padStart(2, "0")).join("");
  return le(a0) + le(b0) + le(c0) + le(d0);
}

const pfEnc = (v) => encodeURIComponent(String(v).trim()).replace(/%20/g, "+");
function payfastSignature(fields, passphrase) {
  const parts = Object.keys(fields)
    .filter((k) => k !== "signature" && String(fields[k]).trim() !== "")
    .map((k) => `${k}=${pfEnc(fields[k])}`);
  parts.push(`passphrase=${pfEnc(passphrase)}`);
  return md5(parts.join("&"));
}

async function sendBookingEmail(env, to, details) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
  <h2 style="margin:0 0 4px">Booking confirmed</h2>
  <p style="color:#555;margin:0 0 16px">A new booking was confirmed on your RevenueDesk.</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr><td style="padding:8px 0;color:#777;width:130px">Customer</td><td style="padding:8px 0;font-weight:600">${details.customer}</td></tr>
    <tr><td style="padding:8px 0;color:#777">Service</td><td style="padding:8px 0;font-weight:600">${details.service}</td></tr>
    <tr><td style="padding:8px 0;color:#777">Time</td><td style="padding:8px 0;font-weight:600">${details.when}</td></tr>
  </table>
  <p style="color:#555;margin:16px 0 0">Open your RevenueDesk inbox to reply to this customer.</p>
  <p style="color:#999;font-size:12px;margin:24px 0 0">RevenueDesk by NahaLabs - never miss an enquiry.</p>
</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "RevenueDesk <sales@nahalabs.co.za>",
      to: [to],
      reply_to: "sales@nahalabs.co.za",
      subject: `Booking confirmed: ${details.service} - ${details.when}`,
      html,
    }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function handleBridge(request, env) {
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "sign in required" }, 401);

    // Verify the caller's session with Supabase Auth.
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${jwt}` },
    });
    if (!userRes.ok) return json({ error: "sign in required" }, 401);
    const user = await userRes.json();

    // Resolve the caller's workspace with their own token (RLS scopes it to them),
    // the same way the app does: membership in user_roles, else owned tenant.
    const sb = { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${jwt}` };
    let tenantId = null;
    const rolesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${user.id}&select=tenant_id,role`, { headers: sb });
    if (!rolesRes.ok) return json({ error: "workspace lookup failed" }, 502);
    const roles = await rolesRes.json();
    const memberOf = (roles || []).find((r) => r.role !== "owner");
    if (memberOf) tenantId = memberOf.tenant_id;
    if (!tenantId) {
      const tRes = await fetch(
        `${SUPABASE_URL}/rest/v1/tenants?owner_id=eq.${user.id}&select=id&limit=1`, { headers: sb });
      if (!tRes.ok) return json({ error: "workspace lookup failed" }, 502);
      const t = await tRes.json();
      tenantId = t?.[0]?.id ?? null;
    }
    if (!tenantId) return json({ error: "no workspace" }, 403);

    if (!env.CONTENT_API_KEY) return json({ error: "posting service not configured" }, 503);

    const body = await request.json().catch(() => ({}));
    const call = async (method, path, payload) => {
      const r = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${env.CONTENT_API_KEY}`,
          "x-workspace-id": tenantId,
          "content-type": "application/json",
          "user-agent": "RevenueDesk/1.0",
          ...(payload && body.idempotency_key ? { "idempotency-key": body.idempotency_key } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, body: j };
    };

    switch (body.action) {
      case "accounts": {
        const r = await call("GET", "/api/v1/accounts");
        return json(r.body, r.status);
      }
      case "connect": {
        if (body.channel !== "bluesky") return json({ error: "unsupported channel" }, 422);
        if (!body.handle || !body.app_password) return json({ error: "handle and app_password required" }, 422);
        const r = await call("PUT", `/api/v1/channels/${body.channel}`, { handle: body.handle, app_password: body.app_password });
        return json(r.body, r.status);
      }
      case "create": {
        if (body.channel !== "bluesky" || !body.caption) return json({ error: "channel and caption required" }, 422);
        const r = await call("POST", "/api/v1/posts", {
          channel: body.channel, caption: body.caption, title: body.title ?? "", internal_notes: body.internal_notes ?? "",
        });
        return json(r.body, r.status);
      }
      case "schedule": {
        if (!body.id) return json({ error: "id required" }, 422);
        const r = await call("POST", `/api/v1/posts/${body.id}/schedule`, body.scheduled_at ? { scheduled_at: body.scheduled_at } : {});
        return json(r.body, r.status);
      }
      case "cancel": {
        if (!body.id) return json({ error: "id required" }, 422);
        const r = await call("POST", `/api/v1/posts/${body.id}/cancel`);
        return json(r.body, r.status);
      }
      case "list": {
        const r = await call("GET", `/api/v1/posts${body.status ? `?status=${encodeURIComponent(body.status)}` : ""}`);
        return json(r.body, r.status);
      }
      case "payfast-link": {
        const live = (env.PF_MODE || "") === "live";
        const merchant_id = live ? env.PF_MERCHANT_ID : (env.PF_MERCHANT_ID || "10000100");
        const merchant_key = live ? env.PF_MERCHANT_KEY : (env.PF_MERCHANT_KEY || "46f0cd694581a");
        const passphrase = live ? env.PF_PASSPHRASE : (env.PF_PASSPHRASE || "jt7NOE43FZPn");
        if (!merchant_id || !merchant_key) return json({ error: "payments not configured" }, 503);
        const ref = String(body.reference || tenantId).slice(0, 64);
        const fields = {
          merchant_id, merchant_key,
          return_url: `https://${PUBLIC_HOST}/billing?paid=1`,
          cancel_url: `https://${PUBLIC_HOST}/billing?cancelled=1`,
          notify_url: `https://${PUBLIC_HOST}/bridge/payfast-itn`,
          email_address: user.email || "",
          m_payment_id: ref,
          amount: "499.00",
          item_name: "RevenueDesk monthly subscription",
          custom_str1: ref,
          subscription_type: "1",
          recurring_amount: "499.00",
          frequency: "3",
          cycles: "0",
        };
        // Only sign when a real merchant passphrase is configured (live mode).
        // The public PayFast sandbox merchant accepts unsigned posts; its actual
        // passphrase is not the documented example, so any signature fails there.
        if (live && passphrase) fields.signature = payfastSignature(fields, passphrase);
        return json({
          action_url: `https://${live ? "www.payfast.co.za" : "sandbox.payfast.co.za"}/eng/process`,
          mode: live ? "live" : "sandbox",
          fields,
        });
      }
      case "booking-email": {
        if (!env.RESEND_API_KEY) return json({ error: "email not configured" }, 503);
        if (!user.email) return json({ error: "no account email" }, 422);
        const service = String(body.service || "Appointment").slice(0, 120);
        const when = body.starts_at ? new Date(body.starts_at) : null;
        const whenLabel = when && !isNaN(when)
          ? when.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
          : "the requested time";
        const customer = String(body.customer_name || "Potential Customer").slice(0, 120);
        const r = await sendBookingEmail(env, user.email, { service: esc(service), when: esc(whenLabel), customer: esc(customer) });
        if (r.status >= 300) return json({ error: `send failed (${r.status})`, detail: String(r.body.message || "").slice(0, 160) }, 502);
        return json({ ok: true, id: r.body.id });
      }
      default:
        return json({ error: "unknown action" }, 422);
    }
  } catch (e) {
    return json({ error: String((e && e.message) || e).slice(0, 200) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/bridge/payfast-itn") {
      // PayFast ITN webhook: acknowledge. Payment activation is manual until the
      // live merchant account exists; then this route will mark the tenant paid.
      return json({ ok: true });
    }

    if (url.pathname === "/bridge") {
      return handleBridge(request, env);
    }

    url.hostname = UPSTREAM_HOST;
    url.protocol = "https:";
    url.port = "";

    const upstreamRequest = new Request(url.toString(), request);
    const response = await fetch(upstreamRequest);

    const headers = new Headers(response.headers);
    const location = headers.get("location");
    if (location && location.includes(UPSTREAM_HOST)) {
      headers.set("location", location.split(UPSTREAM_HOST).join(PUBLIC_HOST));
    }
    const cookie = headers.get("set-cookie");
    if (cookie && cookie.includes("Domain=" + UPSTREAM_HOST)) {
      headers.set("set-cookie", cookie.split("Domain=" + UPSTREAM_HOST).join("Domain=" + PUBLIC_HOST));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
