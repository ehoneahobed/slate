# Slate — Execution Plan & Technical Documentation

This document is the **single source of truth** for building Slate from the current HTML/JSX prototypes toward a **production web app** plus **PWA** and **Tauri** (later). It encodes decisions already made and the phased plan to execute.

**Prototype references (existing repo):**

- `landing.html` — marketing narrative & feature surface
- `Whiteboard.html`, `src/*` — app shell: spine, canvas area, toolbar, inspector, modals
- `design-system.html`, `design-system-print.html` — tokens, typography, print/export styling targets
- `settings.html` — settings UX patterns

---

## 1. Product definition

Slate is a **notebook-first whiteboard for teachers**.

### 1.1 Core hierarchy

- **Notebook → Section → Page** (OneNote-style spine)
- **Vertical, book-like scrolling** across pages (stacked mode) plus optional linear navigation (prototype already explores this via tweaks)

### 1.2 Teaching surface

- **Pressure-sensitive ink** (web: Pointer Events `pressure` where available; fallbacks where not)
- **Page backgrounds:** ruled, grid, plain, **Cornell** (after plain if sequencing matters for MVP)
- **Embeds:** images, video, YouTube/Vimeo, audio, PDF, code, math (LaTeX), tables, stickies, links to pages
- **Three sharing modes**
  1. **Read-only** — like a shared PDF; anonymous allowed (token + optional passcode)
  2. **Read + private annotations** — **sign-in required**; student ink on a private overlay/fork; never mutates teacher base content
  3. **Live collaboration** — **sign-in required**; realtime multi-user board; teacher can end/revoke session

### 1.3 Teacher / class workflows

- **Student preview** (teacher views as student)
- **Focus mode** (hide chrome)
- **Voice narration** per page (publish + replay) — post-MVP phase in this plan
- **PDF export** (print fidelity) — phased; `design-system-print.html` informs CSS

### 1.4 Themes

- Warm paper / clean light / night — persisted per user (and optionally per notebook later)

### 1.5 AI (BYOK)

- Optional; teacher-provided keys; server-side proxy; metering; **off by default** until keys + policy exist
- Student-facing AI should be **policy-gated** (org/teacher toggles)

### 1.6 Explicit non-goals (initial releases)

- **Stripe / billing** — deferred; keep `plan` flags + usage counters so billing is easy later
- **Multi-teacher co-ownership** — deferred; single `ownerUserId` initially; add `notebook_members` later without rewriting hierarchy
- **LMS integrations** (Canvas/Moodle), enterprise SSO/SCIM — later programs
- **Native mobile apps** beyond **PWA** — later

---

## 2. Decisions log (locked for v1 execution)

| Area | Decision |
|------|-----------|
| Web framework | **Next.js** (App Router, TypeScript strict) |
| Primary database | **PostgreSQL** (relational hierarchy + permissions + audit) |
| DB hosting | **Neon** acceptable; **AWS RDS** (or Lightsail-managed Postgres) if “all in AWS” is required |
| App hosting | **AWS Lightsail Containers** (Next.js server + routes) |
| Realtime (live mode) | **Liveblocks** (hosted WebSocket/sync) |
| File assets | **S3-compatible** object storage (e.g. **Cloudflare R2** or **AWS S3**) via signed URLs |
| Sharing default | Anonymous **read-only**; **sign-in** for annotate + live |
| Payments | **Later** |
| Multi-teacher | **Later** |

---

## 3. High-level architecture

```
[Browser / PWA / Tauri shell]
        |
        v
[Next.js on Lightsail] ----auth----> [PostgreSQL]
        |                                    ^
        |                                    | checkpoints
        |                                    | metadata
        v                                    |
[Liveblocks Cloud]  <--- short-lived tokens --|
        ^
        |
   (live collab only)
```

### 3.1 Responsibility split

| Concern | Owner |
|--------|--------|
| Notebooks, sections, pages, permissions | **Postgres** (source of truth) |
| Published read-only snapshots | **Postgres** (+ optional object storage for large blobs) |
| Student private annotation copies | **Postgres** (+ storage pointers) |
| Live session ops, presence, fast concurrent edits | **Liveblocks** (session truth while room open) |
| Durable ink after live session / for export | **Postgres and/or object storage** via **checkpoint** pipeline |

### 3.2 Non-negotiable: checkpointing

Liveblocks must **not** be the only durable store for teaching content.

**Checkpoint** to Postgres (and/or storage) on:

- Teacher **End session** / **Publish**
- **Periodic autosave** while live (e.g. every 30–60s, tuned by cost + risk)
- Best-effort on client navigation teardown

Design APIs and UX so a failed checkpoint is **visible and recoverable** (retry queue).

---

## 4. Suggested repository layout (target monorepo)

```
apps/web                 # Next.js application
packages/ui              # (optional) shared design system components
packages/ink-schema      # (optional) stroke JSON schema + validators
infra/                   # IaC notes, Lightsail, env templates
```

Keep business logic out of Tauri; Tauri is a shell.

---

## 5. Data model (Postgres) — v1 entities

Names are indicative; migrate with Prisma or Drizzle.

### 5.1 Core

- `users` — auth identity, profile
- `workspaces` — teacher home (can equal personal workspace at first)
- `notebooks` — `workspace_id`, `owner_user_id`, title, defaults (theme, page template)
- `sections` — `notebook_id`, `title`, `color`, `position`
- `pages` — `section_id`, `title`, `position`, `background_type`, `locked`, dimensions policy

### 5.2 Content durability

- `page_revisions` or `page_snapshots` — versioned JSON/binary refs for export + read-only publish
- `strokes` (or JSONB blob per revision) — normalized stroke format shared with export pipeline
- `embeds` — type, bbox, metadata, storage keys

### 5.3 Sharing

- `share_links` — opaque token (hash stored), `mode` enum (`READ` | `READ_ANNOTATE` | `LIVE`), optional `passcode_hash`, `expires_at`, `revoked_at`
- `annotation_forks` — maps student → base page revision for private overlay mode

### 5.4 Live sessions (Liveblocks)

- `live_sessions` — `id`, `notebook_id`, `page_id`, `created_by`, `room_key`, `started_at`, `ended_at`, `revoked_at`
- Optional usage counters for future billing: `checkpoint_count`, `live_minutes` aggregates

### 5.5 Audit (minimal early)

- `audit_log` — share created/rotated, export started, AI call counted (avoid storing raw prompts if minimizing PII)

---

## 6. Auth model

### 6.1 Providers

Choose **one** early and stick to it:

- **Auth.js (NextAuth)** + Postgres adapter, or
- **Clerk** (managed, faster ops)

This plan does not mandate which; implementation picks one in Phase 0.

### 6.2 Authorization primitives

- `notebook.owner_user_id` is authoritative for teacher actions initially
- Share link resolves to **capabilities**:
  - READ: public render path
  - READ_ANNOTATE: requires user; writes only to student fork tables
  - LIVE: requires user; issues Liveblocks token only if session active + permitted

---

## 7. Liveblocks integration specification

### 7.1 Packages (expected)

- `@liveblocks/client`
- `@liveblocks/react`
- `@liveblocks/node` (server: auth token minting, optional webhooks)

### 7.2 Room ID strategy

**One Liveblocks room per page per live session** (recommended):

- Smaller blast radius, easier permissions, aligns with “this lecture page”

**Room key format** (example):

```
nb_{notebookId}__pg_{pageId}__sess_{sessionId}
```

or hashed opaque:

```
live_{base64urlSha256(...)}
```

Include `sessionId` so rotation/revocation does not collide with old rooms.

### 7.3 Token flow

1. Client calls Next.js: `POST /api/live/token` (or session-specific route) with session credentials.
2. Server validates Postgres authorization + session not revoked.
3. Server mints **short-lived** Liveblocks access token using **`LIVEBLOCKS_SECRET_KEY`** (server only).
4. Client connects; `RoomProvider` wraps **only** the live canvas subtree.

### 7.4 Storage schema v1 (Liveblocks)

Start minimal; expand later.

Recommended starting point:

- `layers.teacher` — LiveList of stroke objects **or** a compact stroke batching strategy
- `meta` — session id, schema version, last checkpoint id

**Stroke object fields (indicative):**

- `id` (uuid)
- `tool` (`pen` | `hl` | `eraser` | …)
- `color`
- `width`
- `points` — normalized `[{x,y,t,p?}]` or tiled chunks for large drawings
- `embedRef?` — if stroke ties to anchored object

**Rule:** schema must be **exportable** to the same JSON your PDF pipeline consumes (avoid two divergent models).

### 7.5 Presence (optional MVP)

- Remote cursors + “who is here”
- Laser pointer as ephemeral presence (not stored) unless teacher enables “burn-in” (defer)

### 7.6 Server endpoints (indicative)

| Method | Route | Purpose |
|--------|--------|---------|
| `POST` | `/api/live/sessions` | Teacher starts live session for a page |
| `POST` | `/api/live/sessions/:id/end` | End + force checkpoint |
| `POST` | `/api/live/token` | Mint Liveblocks token |
| `POST` | `/api/pages/:id/checkpoint` | Persist Liveblocks snapshot to Postgres (called periodically + on end) |

Rate-limit token minting; cap concurrent sessions per notebook as abuse control.

### 7.7 Environment variables (Lightsail)

```bash
# Database
DATABASE_URL=postgresql://...

# Auth (example names)
AUTH_SECRET=...
# OAuth provider keys if used

# Liveblocks
LIVEBLOCKS_SECRET_KEY=...
# public key if required by your Liveblocks setup

# Object storage
S3_ENDPOINT=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# App
NEXT_PUBLIC_APP_URL=https://...
```

---

## 8. Phased roadmap (execution order)

### Phase 0 — Foundations (1–2 weeks)

**Deliverables**

- Next.js + TS strict + lint/format + test runner baseline
- Postgres + migrations (Prisma or Drizzle)
- Auth working in dev + staging
- Design tokens ported from `design-system.html` into the app theme layer
- CI: typecheck + tests on PR

**Exit criteria**

- Signed-in user can create a notebook and see empty spine + one page

---

### Phase 1 — Notebook OS + single-player ink (2–4 weeks)

**Deliverables**

- CRUD + reorder for notebooks, sections, pages
- Page backgrounds: ruled / grid / plain (Cornell next if prioritized)
- Themes: warm / clean / night
- Focus mode + student preview as UI states
- Ink MVP: pen / highlighter / eraser; persist strokes to Postgres on debounced autosave
- Stroke JSON schema documented in code (`packages/ink-schema` optional)

**Exit criteria**

- Teacher can build a semester notebook structure and draw on pages; refresh restores content

---

### Phase 2 — Read-only publishing (2–3 weeks)

**Deliverables**

- `share_links` with rotation + revocation + optional passcode
- Public read route: `/share/[token]` SSR/ISR strategy chosen and documented
- Watermark optional

**Exit criteria**

- Anonymous student can open read-only notebook reliably; permissions enforced on every API

---

### Phase 3 — Private annotations fork (3–5 weeks)

**Deliverables**

- Signed-in student overlay/fork model tied to base `page_revision`
- UX clearly distinguishes teacher vs student ink
- Teacher updates base → student sees update; private overlay preserved per defined rules

**Exit criteria**

- Mode B works end-to-end under basic concurrency tests

---

### Phase 4 — Live collaboration with Liveblocks (4–8 weeks)

**Deliverables**

- `live_sessions` + room key strategy
- Liveblocks `RoomProvider` integrated only in live mode UI
- Token endpoint + authorization hardening + rate limits
- Checkpoint pipeline to Postgres + failure visibility
- Teacher controls: end session, revoke tokens

**Exit criteria**

- Classroom-scale test (define target: e.g. 20–50 concurrent users) meets latency UX bar you set (document p95 targets per region)

---

### Phase 5 — Embeds & rich content (rolling, 3–6+ weeks)

**Priority order (recommended)**

1. Images + drag/drop + uploads (signed URLs)
2. Stickies + text blocks
3. Code blocks + KaTeX math
4. YouTube/Vimeo embeds
5. Audio recording + playback
6. PDF viewer + annotation mapping

**Exit criteria**

- Teacher can assemble pages comparable to the richest prototype pages

---

### Phase 6 — PDF export (2–4 weeks)

**Deliverables**

- Async export jobs (queue) — **do not** block Lightsail web container on Chromium PDF
- Worker container or external job runner
- Print CSS aligned with `design-system-print.html`

**Exit criteria**

- Export reproduces backgrounds + ink for a representative notebook

---

### Phase 7 — BYOK AI (3–5 weeks)

**Deliverables**

- Encrypted key storage (envelope/KMS pattern documented in implementation)
- Proxy route to providers; quotas; audit counts
- “Ask Slate” grounded on page selection / extracted text pipeline

**Exit criteria**

- Teacher can enable AI with key; students cannot extract keys; org policy can disable

---

### Phase 8 — Voice narration (3–6 weeks)

**Deliverables**

- Audio capture, storage, waveform UI, replay permissions

---

### Phase 9 — PWA hardening (1–2 weeks, parallel)

**Deliverables**

- `manifest.webmanifest`, icons, service worker strategy (Serwist / next-pwa)
- Offline shell + explicit limitations UX

---

### Phase 10 — Tauri desktop (2–4 weeks)

**Deliverables**

- Thin shell loading production web app
- Deep links to notebook/page
- Auto-update later

---

## 9. AWS Lightsail operational notes

- Use **two container services** when cost allows: **web** + **worker** (exports/audio)
- Configure health checks, autoscaling limits, and log shipping (e.g. CloudWatch)
- Secrets via Lightsail secret params or AWS Secrets Manager if you graduate

---

## 10. Security checklist (carry through all phases)

- Never expose `LIVEBLOCKS_SECRET_KEY` to client bundles
- Hash share tokens at rest; rotate on leak suspicion
- Signed URLs for assets; short TTL
- Rate limit: login, token mint, share resolve, upload initiation
- Content Security Policy tuned for embeds (YouTube, etc.) — expect iteration
- Backups: Postgres PITR + object storage lifecycle rules

---

## 11. Immediate next tasks (Definition of Ready for Phase 0)

1. Choose **Auth.js vs Clerk** and document in ADR (one-page).
2. Choose **ORM**: Prisma vs Drizzle (one-page ADR).
3. Create **Neon/RDS** dev database + migration workflow.
4. Extract **design tokens** from `design-system.html` into the Next app theme.
5. Draft **stroke JSON schema v1** in `/docs/STROKE_SCHEMA_V1.md` (small follow-up doc).
6. Create **Lightsail staging** environment + secrets + CI deploy path.

---

## 12. Glossary

- **Checkpoint** — persist Liveblocks session state into durable storage controlled by Slate
- **BYOK** — bring your own API key (teacher-provided)
- **Mode A/B/C** — read-only / annotate / live (this document §1.2)

---

## Document control

- **Owner:** engineering lead (you)
- **Update cadence:** after each phase retrospective
- **Version:** 1.0 (initial execution plan)

### Phase 0 implementation (repo)

Execution has started. See:

- **[`README.md`](../README.md)** — local Postgres (`docker compose`), env vars, `db:push`, dev server
- **`apps/web/`** — Next.js (App Router) + Drizzle schema + Auth.js (GitHub) + dashboard notebook CRUD smoke test

Stroke schema: [`docs/STROKE_SCHEMA_V1.md`](STROKE_SCHEMA_V1.md).

**Phase 1 (in progress in repo):** page editor route, Postgres-backed ink (`strokesData`), themes (`user_settings`), focus/student preview UI, page CRUD + reorder within section.
