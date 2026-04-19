-- Reference SQL (optional). Prefer the Node script so `.env.local` is loaded:
--   pnpm db:reset-auth-tables
--
-- If you still use psql, pass the full URL (shell DATABASE_URL is often empty):
--   psql "postgresql://slate:slate@127.0.0.1:5432/slate" -f scripts/reset-auth-tables-for-better-auth.sql

DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "verificationToken" CASCADE;

-- Optional: only if `user` still matches the OLD NextAuth shape and push keeps failing.
-- This deletes all users and anything that FKs to `user` (workspaces, notebooks, etc.).
-- UNCOMMENT ONLY if you intend a full local reset:
-- DROP TABLE IF EXISTS "user" CASCADE;
