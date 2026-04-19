/**
 * Adds `pageSize` and `blocksData` on `"page"` if missing (matches Drizzle schema).
 * Run after pulling schema changes: `pnpm --filter web db:ensure-page-columns`
 *
 * Loads `apps/web/.env.local` then `.env`. Default URL: postgresql://slate:slate@127.0.0.1:5432/slate
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");

for (const name of [".env.local", ".env"]) {
  const p = join(webRoot, name);
  if (existsSync(p)) config({ path: p });
}

const databaseUrl =
  process.env.DATABASE_URL?.trim() || "postgresql://slate:slate@127.0.0.1:5432/slate";

const statements = [
  `ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "pageSize" text NOT NULL DEFAULT '16_10'`,
  `ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "blocksData" jsonb NOT NULL DEFAULT '[]'::jsonb`,
];

const client = postgres(databaseUrl, { max: 1 });
try {
  for (const stmt of statements) {
    await client.unsafe(stmt);
    console.log("OK:", stmt);
  }
  console.log("\nDone. Restart the dev server if it was running.");
} finally {
  await client.end({ timeout: 1 });
}
