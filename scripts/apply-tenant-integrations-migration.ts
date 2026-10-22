import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

// FAIL-CLOSED TARGET PROOF - runs before any DDL.
// The only database this migration may touch is the RevenueDesk app's own
// Supabase project. The expected project ref comes from the app's shipped
// config (.env VITE_SUPABASE_URL), not from the secret and not from history.
const EXPECTED_PROJECT_REF = "zdaolncziicfgpfknxyd";
const EXPECTED_DIRECT_HOST = `db.${EXPECTED_PROJECT_REF}.supabase.co`;

const migrations = ["supabase/migrations/20261022100000_tenant_integrations.sql"];

const databaseUrl = process.env["SUPABASE_DB_URL"];
if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL is required.");
}

// 1) Non-secret connection assertion. The secret value is never printed.
let parsed: URL;
try {
  parsed = new URL(databaseUrl);
} catch {
  throw new Error("SUPABASE_DB_URL is not a valid URL.");
}
const isDirect = parsed.hostname === EXPECTED_DIRECT_HOST;
const isPoolerForProject =
  parsed.hostname.endsWith(".pooler.supabase.com") &&
  decodeURIComponent(parsed.username) === `postgres.${EXPECTED_PROJECT_REF}`;
if (!isDirect && !isPoolerForProject) {
  console.error(
    "[preflight] FAIL CLOSED: SUPABASE_DB_URL does not target the expected project. No DDL run.",
  );
  process.exit(1);
}
console.log(
  `[preflight] connection target matches expected project ref ${EXPECTED_PROJECT_REF} (${isDirect ? "direct" : "pooler"}).`,
);

const sql = postgres(databaseUrl, { max: 1, ssl: "require", connect_timeout: 15 });

try {
  // 2) Owning-DB source check: tables only the real app database holds
  //    (the live app and content-bridge depend on them).
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name in ('tenants', 'user_roles', 'service_config')`;
  const have = new Set(rows.map((r) => r.table_name));
  const missing = ["tenants", "user_roles", "service_config"].filter((t) => !have.has(t));
  if (missing.length > 0) {
    console.error(
      `[preflight] FAIL CLOSED: target database lacks expected app tables: ${missing.join(", ")}. No DDL run.`,
    );
    process.exit(1);
  }
  console.log("[preflight] target database holds expected app tables (tenants, user_roles, service_config).");

  for (const relativePath of migrations) {
    const migration = await fs.readFile(path.resolve(relativePath), "utf8");
    console.log("[tenant-integrations-db] Applying " + relativePath);
    await sql.unsafe(migration);
  }
  console.log("[tenant-integrations-db] tenant_integrations migration applied.");
} finally {
  await sql.end({ timeout: 5 });
}
