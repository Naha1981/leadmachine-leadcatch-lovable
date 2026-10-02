export const IP_LIMIT = 5;
export const PHONE_LIMIT = 3;

export async function checkDurableQuoteLimits(
  db: any,
  slug: string,
  ipHash: string,
  phone: string,
): Promise<string | null> {
  const tenMin = new Date(Date.now() - 10 * 60_000).toISOString();
  const hour = new Date(Date.now() - 60 * 60_000).toISOString();

  const [ipRes, phoneRes] = await Promise.all([
    db
      .from("quote_submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", tenMin),
    db
      .from("quote_submissions")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", hour),
  ]);

  if (ipRes.error || phoneRes.error) {
    console.error("rate limit lookup failed", ipRes.error ?? phoneRes.error);
    throw new Error("QUOTE_RATE_LIMIT_UNAVAILABLE");
  }

  if ((ipRes.count ?? 0) >= IP_LIMIT) {
    return "Too many enquiries from this connection. Please try again shortly.";
  }

  if ((phoneRes.count ?? 0) >= PHONE_LIMIT) {
    return "We've already received your enquiry. The business will be in touch soon.";
  }

  const inserted = await db
    .from("quote_submissions")
    .insert({ slug, ip_hash: ipHash, phone });

  if (inserted.error) {
    console.error("rate limit record insert failed", inserted.error);
    throw new Error("QUOTE_RATE_LIMIT_UNAVAILABLE");
  }

  return null;
}
