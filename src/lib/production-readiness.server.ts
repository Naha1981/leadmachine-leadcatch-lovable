import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const REQUIRED_PRODUCTION_TABLES = [
  "whatsapp_operator_credentials",
  "platform_admins",
  "zero_ui_action_receipts",
  "zero_ui_configs",
  "zero_ui_followups",
] as const;

export type ProductionReadiness = {
  ready: boolean;
  checkedAt: string;
  checks: {
    supabase: boolean;
    whatsappOperatorConfigured: boolean;
  };
  missingTables: string[];
};

export async function getProductionReadiness(): Promise<ProductionReadiness> {
  const checkedAt = new Date().toISOString();
  const supabaseConfigured = Boolean(
    process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"],
  );
  const whatsappOperatorConfigured = Boolean(
    process.env["OPERATOR_URL"] || "https://my-own-whatsapp-2z5h.onrender.com",
  );

  if (!supabaseConfigured) {
    return {
      ready: false,
      checkedAt,
      checks: { supabase: false, whatsappOperatorConfigured },
      missingTables: [...REQUIRED_PRODUCTION_TABLES],
    };
  }

  const db = supabaseAdmin as any;
  const results = await Promise.all(
    REQUIRED_PRODUCTION_TABLES.map(async (table) => {
      try {
        // A real row read (not HEAD) so a missing table surfaces as PGRST205 instead of an empty 204.
        const { error } = await db.from(table).select("*").limit(1);
        return { table, ready: !error };
      } catch {
        return { table, ready: false };
      }
    }),
  );

  const missingTables = results.filter((result) => !result.ready).map((result) => result.table);
  const ready = missingTables.length === 0 && whatsappOperatorConfigured;

  if (missingTables.length > 0) {
    console.error(
      "[production-readiness] Missing required database tables: " + missingTables.join(", "),
    );
  }

  return {
    ready,
    checkedAt,
    checks: {
      supabase: true,
      whatsappOperatorConfigured,
    },
    missingTables,
  };
}
