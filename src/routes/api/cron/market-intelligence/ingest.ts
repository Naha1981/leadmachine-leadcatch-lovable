import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SourceType = z.enum(["reddit","youtube","x","web","competitor","website","internal","agent_reach"]);
const Document = z.object({
  tenantId: z.string().uuid(),
  source: z.string().min(1).max(200),
  sourceType: SourceType,
  sourceUrl: z.string().url().max(2000),
  externalId: z.string().max(500).optional().nullable(),
  title: z.string().max(500).default(""),
  author: z.string().max(300).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  content: z.string().min(1).max(15000),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const Route = createFileRoute("/api/cron/market-intelligence/ingest")({
  server: { handlers: {
    POST: async ({ request }) => {
      const expected = process.env["MARKET_INTELLIGENCE_CRON_SECRET"] || process.env["CRON_SECRET"];
      if (!expected || request.headers.get("authorization") !== "Bearer " + expected) return new Response("Unauthorized", { status: 401 });
      const body = await request.json().catch(() => null);
      const parsed = z.object({ documents: z.array(Document).min(1).max(200) }).safeParse(body);
      if (!parsed.success) return Response.json({ ok: false, error: "Invalid document payload", details: parsed.error.flatten() }, { status: 400 });
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const tenantIds = [...new Set(parsed.data.documents.map((doc) => doc.tenantId))];
      const { data: enabledProfiles } = await db.from("business_profiles").select("tenant_id,market_intelligence_enabled").in("tenant_id", tenantIds);
      const enabled = new Set((enabledProfiles ?? []).filter((profile: any) => profile.market_intelligence_enabled).map((profile: any) => profile.tenant_id));
      const rows = parsed.data.documents.filter((doc) => enabled.has(doc.tenantId)).map((doc) => ({
        tenant_id: doc.tenantId, source: doc.source, source_type: doc.sourceType, source_url: doc.sourceUrl, external_id: doc.externalId ?? null, title: doc.title, author: doc.author ?? null, published_at: doc.publishedAt ?? null, content: doc.content, metadata: doc.metadata ?? {}, content_hash: createHash("sha256").update([doc.sourceType, doc.sourceUrl, doc.externalId ?? "", doc.title, doc.content].join("\n")).digest("hex"),
      }));
      if (!rows.length) return Response.json({ ok: true, accepted: 0, duplicates: 0 });
      const { data: inserted, error } = await db.from("market_intelligence_documents").upsert(rows, { onConflict: "tenant_id,content_hash", ignoreDuplicates: true }).select("id");
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, accepted: inserted?.length ?? 0, duplicates: rows.length - (inserted?.length ?? 0) });
    },
  }},
});
