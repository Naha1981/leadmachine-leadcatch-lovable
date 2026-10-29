// Privileged database operations for RevenueDesk.
//
// The Supabase project is managed by Lovable Cloud, which never exposes
// SUPABASE_SERVICE_ROLE_KEY. Privileged writes therefore go through one
// whitelisted SECURITY DEFINER Postgres function (public.rd_privileged_op,
// installed via the SQL editor) called over PostgREST rpc with the
// publishable key. The function checks a shared secret stored as a hash and
// only runs fixed, whitelisted statements - no generic table access exists.
const SUPABASE_URL = process.env["SUPABASE_URL"]?.trim();
const PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();
const OPS_SECRET = process.env["PRIVILEGED_OPS_SECRET"]?.trim();

export class PrivilegedOpsError extends Error {}

export async function privOp<T = any>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !OPS_SECRET) {
    throw new PrivilegedOpsError(
      "Privileged operations are not configured. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and PRIVILEGED_OPS_SECRET in the server environment.",
    );
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rd_privileged_op`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ p_secret: OPS_SECRET, p_action: action, p_payload: payload }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = typeof body?.message === "string" ? body.message : text.slice(0, 300);
    throw new PrivilegedOpsError(`Privileged op ${action} failed (${response.status}): ${detail || response.statusText}`);
  }
  return body as T;
}
