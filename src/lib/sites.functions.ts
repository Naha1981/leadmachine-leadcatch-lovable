import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getE2EBusiness, isE2EEnabled } from "@/lib/e2e-store.server";

export type PublicSite = {
  slug: string;
  headline: string;
  subheadline: string;
  about: string;
  services: Array<{ name: string; description: string }>;
  faqs: Array<{ q: string; a: string }>;
  cta_text: string;
  accent: string;
  whatsapp_number: string | null;
  quote_form_token: string;
};

/** Public read of a published business page (anon RLS: published = true). */
export const getPublicSite = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data }): Promise<PublicSite | null> => {
    const { createQuoteFormToken } = await import("@/lib/quote-form-token.server");
    if (isE2EEnabled() && data.slug.toLowerCase() === "e2e-leadmachine") {
      const business = getE2EBusiness();
      return {
        slug: business.slug,
        headline: business.businessName,
        subheadline: "Fast plumbing help across Gauteng.",
        about: "A controlled test business page for automated acceptance tests.",
        services: [
          { name: "Emergency plumbing", description: "Fast help for urgent plumbing problems." },
          { name: "Geyser repairs", description: "Repairs for common geyser faults." },
        ],
        faqs: [{ q: "Do you handle emergencies?", a: "Yes. Send your suburb and the problem." }],
        cta_text: "Get a free quote on WhatsApp",
        accent: "emerald",
        whatsapp_number: "27825550111",
        quote_form_token: createQuoteFormToken(business.slug),
      };
    }

    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: s, error } = await db
      .from("websites")
      .select("slug, headline, subheadline, about, services, faqs, cta_text, accent, whatsapp_number")
      .eq("slug", data.slug.toLowerCase())
      .eq("published", true)
      .maybeSingle();
    if (error) console.error("public site read failed", error);
    if (!s) return null;
    return {
      ...s,
      quote_form_token: createQuoteFormToken(s.slug),
      services: Array.isArray(s.services) ? (s.services as PublicSite["services"]) : [],
      faqs: Array.isArray(s.faqs) ? (s.faqs as PublicSite["faqs"]) : [],
    };
  });
