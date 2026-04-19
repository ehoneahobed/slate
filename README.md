# Slate

Notebook-first whiteboard for teachers. This repo contains **static HTML/JSX prototypes** and the new **Next.js application** under `apps/web`.

## Documentation

- **[Execution plan](docs/SLATE_EXECUTION_PLAN.md)** — phased roadmap, architecture, Liveblocks, hosting.
- **[Deploy to Vercel + Neon](docs/DEPLOY_VERCEL_NEON.md)** — production hosting, env vars, and applying the schema to Neon.

## Phase 0 — run the web app

### 1) Start Postgres

From the repo root:

```bash
docker compose up -d
```

### 2) Configure env

Copy `apps/web/.env.example` → `apps/web/.env.local` and set:

- `DATABASE_URL` (optional for local dev: defaults to `postgresql://slate:slate@127.0.0.1:5432/slate` in both Next.js and `drizzle-kit` when unset — matches root `docker-compose.yml`)
- `AUTH_SECRET` (random string)
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` (GitHub OAuth app; callback `http://localhost:3010/api/auth/callback/github`)
- `AUTH_URL=http://localhost:3010` (recommended locally so Auth.js builds correct OAuth redirect URLs)

`drizzle-kit` loads `.env.local` / `.env` from `apps/web` via `drizzle.config.ts` (it does **not** use Next’s env loading).

### 3) Install & push schema

**From the repo root** (recommended):

```bash
# npm
npm install
npm run db:push -w web

# pnpm (requires pnpm-workspace.yaml — already in this repo)
pnpm install
pnpm --filter web db:push
```

**From `apps/web` only** (no workspace filter — do not pass `-w web` here):

```bash
cd apps/web
npm install   # or: pnpm install
npm run db:push   # or: pnpm db:push
```

Why `pnpm db:push -w web` failed: `-w web` is an **npm workspaces** flag meant for the **root** `package.json`. When you run it inside `apps/web`, pnpm forwards it to `drizzle-kit push`, which does not understand `-w`.

Why `npm db:push` failed: the correct npm form is **`npm run`** + script name, e.g. `npm run db:push -w web` from the root (or `npm run db:push` from `apps/web`).

### 4) Dev server

**From repo root:**

```bash
npm run dev
# or
pnpm --filter web dev
```

**From `apps/web`:**

```bash
pnpm dev
# or
npm run dev
```

Open `http://localhost:3010` (dev server default port), sign in, then open **Dashboard** to create/list notebooks.

To use another port for one run: from `apps/web`, run `pnpm exec next dev --port 3020`. To change the default, edit the `dev` script in `apps/web/package.json` (currently `--port 3010`).

### Phase 1 (current)

- Open a notebook → click a **page** to launch the **page editor** (16×10 sheet, ruled/grid/plain/Cornell, pen/highlighter/eraser).
- Ink **autosaves** to Postgres (`strokesData` JSONB). Schema: [`docs/STROKE_SCHEMA_V1.md`](docs/STROKE_SCHEMA_V1.md).
- **Themes** (paper / clean / dark) persist per user (`user_settings`) and apply via `data-theme` on `<html>`.
- **Focus** and **student preview** (read-only canvas) are UI states on the editor.
- **New page**, **delete page** (blocked if it’s the only page in the notebook), **move ↑ / ↓** within the section.

After pulling schema changes, run **`pnpm --filter web db:push`** (or `npm run db:push -w web`) from the repo root.

## Monorepo scripts

From **repo root** (npm):

| Script                 | Purpose                 |
| ---------------------- | ----------------------- |
| `npm run dev -w web`   | Next dev (`apps/web`)  |
| `npm run build -w web` | Production build        |
| `npm run lint -w web`  | ESLint                  |
| `npm run typecheck -w web` | `tsc --noEmit`     |
| `npm run test -w web`  | Vitest                  |
| `npm run db:push -w web` | Drizzle `push` to DB |

From **repo root** (pnpm): prefix with `pnpm --filter web …`, e.g. `pnpm --filter web db:push`, `pnpm --filter web dev`.

## Prototypes (legacy)

- `landing.html`, `Whiteboard.html`, `design-system.html`, `settings.html` — open directly or serve with any static server.
