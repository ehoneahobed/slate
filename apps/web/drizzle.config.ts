import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

// Drizzle CLI does not load Next.js env files. Mirror local defaults from `docker-compose.yml`.
loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const databaseUrl =
  process.env.DATABASE_URL?.trim() || "postgresql://slate:slate@127.0.0.1:5432/slate";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
