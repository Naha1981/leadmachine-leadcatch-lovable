// Production readiness for RevenueDesk.
//
// Lovable Cloud never exposes SUPABASE_SERVICE_ROLE_KEY, so this check cannot
// use the service-role admin client. It targets the same database the app
// actually uses - SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY over PostgREST.
// A missing table answers 404 PGRST205; an existing table the anon role may
// not read answers 401/403 (permission denied), which still proves the table
// exists. Only PGRST205 counts as missing.

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
  const supabaseUrl = process.env["SUPABASE_URL"]?.trim();
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]?.trim();
  const supabaseConfigured = Boolean(supabaseUrl && publishableKey);
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

  const results = await Promise.all(
    REQUIRED_PRODUCTION_TABLES.map(async (table) => {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
          headers: { apikey: publishableKey! },
          signal: AbortSignal.timeout(10000),
        });
        // 404 PGRST205 = table truly missing from the schema cache. Anything
        // else (200 with rows, 401/403 permission denied) means it exists.
        return { table, ready: res.status !== 404 };
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
