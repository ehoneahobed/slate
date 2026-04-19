/**
 * Drops legacy NextAuth auth tables so `pnpm db:push` can apply Better Auth schema.
 *
 * Loads `apps/web/.env.local` then `.env` (same idea as drizzle). Falls back to Docker Compose
 * default: postgresql://slate:slate@127.0.0.1:5432/slate
 *
 * Usage: `pnpm --filter web db:reset-auth-tables` (from repo root) or `pnpm db:reset-auth-tables` from apps/web.
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

const drops = [
  `DROP TABLE IF EXISTS "session" CASCADE`,
  `DROP TABLE IF EXISTS "account" CASCADE`,
  `DROP TABLE IF EXISTS "verification" CASCADE`,
  `DROP TABLE IF EXISTS "verificationToken" CASCADE`,
];

const client = postgres(databaseUrl, { max: 1 });
try {
  for (const stmt of drops) {
    await client.unsafe(stmt);
    console.log("OK:", stmt);
  }
  console.log("\nDone. Next: pnpm db:push");
} finally {
  await client.end({ timeout: 5 });
}
