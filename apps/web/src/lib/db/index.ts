import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Default local URL matches `docker-compose.yml` at repo root.
 *
 * Note: `next build` runs with `NODE_ENV=production` while bundling route modules, so we cannot
 * hard-throw here without breaking CI/builds. **Deployments must still set `DATABASE_URL`**
 * for `next start` / runtime against real infrastructure.
 */
function resolveDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  return "postgresql://slate:slate@127.0.0.1:5432/slate";
}

const client = postgres(resolveDatabaseUrl(), { max: 10 });

export const db = drizzle(client, { schema });
export type Db = typeof db;
