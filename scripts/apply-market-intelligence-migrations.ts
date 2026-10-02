import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const migrations = [
  "supabase/migrations/20261002010000_market_intelligence.sql",
  "supabase/migrations/20261002020000_market_intelligence_documents.sql",
];

const databaseUrl = process.env["SUPABASE_DB_URL"];
if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL is required.");
}

const sql = postgres(databaseUrl, { max: 1, ssl: "require" });

try {
  for (const relativePath of migrations) {
    const migration = await fs.readFile(path.resolve(relativePath), "utf8");
    console.log("[mi-db] Applying " + relativePath);
    await sql.unsafe(migration);
  }
  console.log("[mi-db] Market Intelligence migrations applied.");
} finally {
  await sql.end({ timeout: 5 });
}
