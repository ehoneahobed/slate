# Deploy Slate to Vercel + Neon

This guide deploys the Next.js app in `**apps/web**` against a **Neon** Postgres database. Schema is applied with **Drizzle `db:push`** (there is no checked-in SQL migration bundle yet).

## 1) Neon

1. Create a project at [https://neon.tech](https://neon.tech).
2. Create a database (default is fine).
3. In the Neon dashboard, copy a connection string:
  - Prefer the **pooled** / **serverless** connection string for Vercel (often labeled for serverless or uses port `6543` with pooling). This works well with the `postgres` driver used in `apps/web`.
4. Ensure the URL includes SSL if Neon shows it (for example `?sslmode=require`).

Set this value as `**DATABASE_URL`** in Vercel (step 3).

## 2) Apply the schema to Neon (one-time, from your machine)

From the **repository root**:

```bash
cd apps/web
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL to your Neon connection string (pooled is OK).
pnpm install
pnpm run db:push
```

Or with npm:

```bash
cd apps/web
npm install
npm run db:push
```

`drizzle-kit push` reads `DATABASE_URL` from `.env.local` or `.env` (see `apps/web/drizzle.config.ts`). After this succeeds, Neon has the same tables as local development.

## 3) Vercel project

1. Import the Git repo in [Vercel](https://vercel.com).
2. **Root Directory**: set to `**apps/web`** (this is a monorepo; the Next app lives here).
3. **Framework Preset**: Next.js (auto-detected when root is `apps/web`).
4. **Node.js version**: **20.x** or newer (matches `engines` in `package.json`).

### Environment variables (Production + Preview)

Add these in **Project → Settings → Environment Variables**:


| Name                  | Notes                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Neon connection string (pooled/serverless URL recommended).                                                                                              |
| `BETTER_AUTH_URL`     | Public origin of the app, **no trailing slash**, e.g. `https://your-app.vercel.app` or your custom domain. Must match the URL users open in the browser. |
| `BETTER_AUTH_SECRET`  | At least **32 characters**. Generate locally: `openssl rand -base64 32`.                                                                                 |
| `NEXT_PUBLIC_APP_URL` | Optional; same as public origin if you use share links (`apps/web/src/lib/share/url.ts`).                                                                |


**Magic link email (production)**  
`apps/web/src/lib/auth.ts` requires **Resend** (or you will get an error when signing in with magic link):


| Name             | Notes                                                      |
| ---------------- | ---------------------------------------------------------- |
| `RESEND_API_KEY` | From [Resend](https://resend.com).                         |
| `EMAIL_FROM`     | Verified sender, e.g. `Slate <onboarding@yourdomain.com>`. |


**GitHub OAuth (optional)**  
If you use GitHub sign-in, add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and in the GitHub OAuth app set the callback URL to:

`https://<your-vercel-host>/api/auth/callback/github`

Use the same host you put in `BETTER_AUTH_URL`.

## 4) Deploy

Push to the branch connected to Vercel; the build runs `next build` from `apps/web`. After deploy, open `BETTER_AUTH_URL` in the browser and sign in.

## 5) Troubleshooting

- **Auth or cookies misbehave**  
Confirm `BETTER_AUTH_URL` exactly matches the site origin (scheme + host, no trailing slash).
- **Database connection errors on Vercel**  
Use Neon’s **pooled** connection string for serverless. Check that `DATABASE_URL` is set on Production (and Preview if you use preview DBs).
- **“Configure RESEND…” on sign-in**  
Set `RESEND_API_KEY` and `EMAIL_FROM`, or use GitHub OAuth only for testing.
- **Schema out of date after a pull**  
Run `pnpm run db:push` (from `apps/web`) against Neon again with the same `DATABASE_URL`.

## Optional: deploy from repo root without changing Vercel root

If you prefer the Vercel root to stay the monorepo root, set **Root Directory** to `.` and configure:

- **Install command**: e.g. `npm install` or `pnpm install` at repo root.
- **Build command**: `npm run build -w web` or `pnpm --filter web build`.
- **Output directory**: Next.js default for a nested app is non-trivial; using `**apps/web` as Root Directory** is the supported, simpler setup.

