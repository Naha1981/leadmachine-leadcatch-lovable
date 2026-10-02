import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const MIGRATIONS = [
  "supabase/migrations/20260930040000_zero_ui_hardening.sql",
  "supabase/migrations/20260930050000_agent_workforce_execution.sql",
  "supabase/migrations/20261001020000_whatsapp_operator_tenant_credentials.sql",
] as const;

const databaseUrl = process.env["SUPABASE_DB_URL"];

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DB_URL is required. Use the Supabase Postgres connection string for the production database.",
  );
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
});

try {
  for (const relativePath of MIGRATIONS) {
    const filePath = path.resolve(relativePath);
    const migration = await fs.readFile(filePath, "utf8");
    process.stdout.write("[db-migrate] Applying " + relativePath + "\n");
    await sql.unsafe(migration);
  }

  process.stdout.write("[db-migrate] Production hardening migrations applied successfully.\n");
} finally {
  await sql.end({ timeout: 5 });
}
