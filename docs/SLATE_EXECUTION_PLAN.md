# Slate — Execution Plan & Technical Documentation

This document is the **single source of truth** for building Slate from the current HTML/JSX prototypes toward a **production web app** plus **PWA** and **Tauri** (later). It encodes decisions already made and the phased plan to execute.

**Prototype references (existing repo):** there are no separate raster “prototype images”; visuals are HTML/CSS (e.g. `landing.html` hero) plus the interactive **`Whiteboard.html`** shell and **`src/*.jsx`** modals/inspector.

- `landing.html` — marketing narrative & feature surface
- `Whiteboard.html`, `src/*` — app shell: spine, canvas area, toolbar, inspector, modals
- `design-system.html`, `design-system-print.html` — tokens, typography, print/export styling targets
- `settings.html` — settings UX patterns

---

## Near-term focus (updated)

Until the **solo notebook + whiteboard** experience is *best-in-class*, execution prioritizes:

- **You** as the primary user: learning, prep, and **livestream as a personal board** (one writer, no classroom assumptions).
- **Rich pages**: ink, structure, and **embeds** (math, code, media, PDFs, etc.) working reliably—not a thin sketch app.
- **Polish**: stylus, scrolling, focus, performance, and persistence—not feature breadth for distribution.

**Explicitly deferred for this milestone:** multi-user collaboration, student/teacher workflows, rostering, private annotation forks, Liveblocks rooms, and “share as a product” beyond whatever already exists for your own testing. Those specs stay in this document (§1.8, §5–§7, deferred roadmap track) but **do not block** embed and whiteboard work.

---

## 1. Product definition

Slate is a **notebook-first whiteboard**: structured notes plus an infinite-quality drawing surface. The original positioning emphasized teachers and classrooms; the **current execution priority** is the **personal power-user** path described above, then classroom/distribution features.

### 1.1 Core hierarchy

- **Notebook → Section → Page** (OneNote-style spine)
- **Vertical, book-like scrolling** across pages (“following” sheets under the active page) plus section/page navigation from the notebook overview

### 1.2 Surface capabilities — **implemented** (`apps/web`)

The live app today (verify in `apps/web`; types in `lib/page-blocks/types.ts`):

- **Ink:** pen, highlighter, eraser; debounced persist to Postgres (`pages.strokesData`); documented stroke shape in [`STROKE_SCHEMA_V1.md`](STROKE_SCHEMA_V1.md).
- **Canvas tools:** laser, pan/move, select, text tool; rough **shapes** (rectangle, ellipse, diamond) with stroke/fill and hand-drawn rendering.
- **Page:** backgrounds **ruled / grid / plain / Cornell**; **page sizes** `16_10`, `a4`, `letter`, `infinite` (schema + editor).
- **Blocks on page:** **text** (multi-font, segment-level styling), **YouTube** embeds (video id + frame), **image** blocks (`https` URL src), rough shapes as blocks.
- **Notebook OS:** workspaces, notebooks, sections, pages; CRUD; reorder pages within a section; delete page (guarded when last in notebook).
- **Vertical continuation:** following pages in the same section load below the editor; each sheet is **editable** with the same tools (focus model for undo/shortcuts).
- **Themes:** warm paper / clean / dark via `user_settings`, applied at document root.
- **Focus mode** (hide chrome) and **student preview** (read-only canvas state)—useful for checking how a stream audience might see the board; not collaboration.
- **Export path today:** browser **Print → Save as PDF** from the editor (not async server export).

**Gaps vs “best in class” (near-term backlog):** Pointer Events **pressure** is not yet wired through ink width; many **embed types** from the product vision are still missing (see §8.1). Insert/slash flows and dock actions should consistently target the **actively focused** sheet (primary vs following page).

### 1.3 Target surface (full vision — not all shipped)

- **Pressure-sensitive ink** (web: Pointer Events `pressure` where available; fallbacks where not)
- **Embeds (target set):** uploaded images and files, **video files**, **YouTube + Vimeo**, **audio** (record + playback), **PDF** on canvas, **code** blocks, **KaTeX / LaTeX**, **tables**, **stickies**, **internal links** to pages—plus drag/drop and signed URL uploads where blobs are large

### 1.4 Themes

- Warm paper / clean light / night — persisted per user (and optionally per notebook later)

### 1.5 AI (BYOK)

- Optional; teacher-provided keys; server-side proxy; metering; **off by default** until keys + policy exist
- Org/teacher policy gates when student-facing—**out of scope** until the core notebook milestone

### 1.6 Voice & narration

- **Voice narration** per page (publish + replay) — post–core-notebook phase in this plan

### 1.7 PDF export (production-grade)

- **Async export** and print CSS aligned with `design-system-print.html` — after the core writing experience is solid; browser print remains the interim

### 1.8 Deferred: classroom, sharing modes, and collaboration (spec retained)

When distribution matters again, the product still intends:

- **Three sharing modes**
  1. **Read-only** — like a shared PDF; anonymous allowed (token + optional passcode)
  2. **Read + private annotations** — sign-in required; student ink on a private overlay/fork
  3. **Live collaboration** — sign-in required; realtime board; teacher end/revoke

Schema today includes `share_link` with a `mode` column; **read-only sharing routes exist** for early testing—full Phase 2–4 delivery stays **after** §8.1 exit criteria.

### 1.9 Explicit non-goals (initial releases)

- **Stripe / billing** — deferred; keep `plan` flags + usage counters so billing is easy later
- **Multi-teacher co-ownership** — deferred; single `ownerUserId` initially; add `notebook_members` later without rewriting hierarchy
- **LMS integrations** (Canvas/Moodle), enterprise SSO/SCIM — later programs
- **Native mobile apps** beyond **PWA** — later

---

## 2. Decisions log (locked for v1 execution)

| Area | Decision |
|------|-----------|
| Web framework | **Next.js** (App Router, TypeScript strict) |
| ORM (implemented) | **Drizzle** + `drizzle-kit` push workflow |
| Auth (implemented) | **Better Auth** (see §6.1) |
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

Names are indicative; **`apps/web` uses Drizzle** (Prisma remains a valid alternative for other codebases).

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

### 6.1 Providers (**implemented**)

- **`apps/web` uses [Better Auth](https://www.better-auth.com/)** with Drizzle-backed tables (email/password and OAuth providers as configured in env)—this supersedes the earlier “Auth.js vs Clerk” open choice for the current codebase.
- Adding Clerk later would be a product decision, not required for the notebook milestone.

### 6.2 Authorization primitives

- `notebook.owner_user_id` is authoritative for teacher actions initially
- Share link resolves to **capabilities**:
  - READ: public render path
  - READ_ANNOTATE: requires user; writes only to student fork tables
  - LIVE: requires user; issues Liveblocks token only if session active + permitted

---

## 7. Liveblocks integration specification

**Execution:** not started in `apps/web`. This section remains the **target spec** for when collaboration returns to the roadmap (after §8.1). Checkpointing rules still apply whenever Liveblocks ships.

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

Roadmap is split into **(A) the active “solo notebook + whiteboard” track**, then **retro status** for early phases, then a **deferred distribution/collaboration track** unchanged in intent.

### 8.1 Current priority — Notebook & whiteboard excellence (solo)

Goal: **best-in-class** personal notetaking + whiteboard for deep work and **livestream as your only board**—before classroom or realtime features.

#### A — Embeds & rich page content (primary backlog)

**Already in app:** text blocks (fonts + segments), YouTube blocks, image blocks via `https` URL, rough shapes.

**Recommended build order** (tune for what blocks your streams first):

1. **Image uploads** — drag/drop and picker, **S3/R2-compatible signed URLs**, persist `src` to your bucket (stop relying on hotlink-only URLs).
2. **Math / LaTeX** — KaTeX (inline + block), persisted as a block type; export/print considerations documented when added.
3. **Code blocks** — syntax highlight, monospace layout, language label; persisted block type.
4. **Tables** — simple grid first (rows/columns, cell text); merge styling later if needed.
5. **Stickies** — lightweight colored note blocks (prototype parity).
6. **Vimeo** — extend embed parser or separate block kind alongside YouTube.
7. **Video file** — upload + signed URL + `<video>` block (or embed wrapper).
8. **Audio** — attach clip or record-in-browser (storage + waveform UI can trail playback).
9. **PDF** — viewer region on page; pan/zoom; optional ink layer relationship (annotation mapping is harder—phase if needed).
10. **Link to page** — internal jump within notebook (and cross-notebook later).

**Cross-cutting for A:** insert menu and `/` command should add blocks to the **focused** page (primary or a following sheet); CSP updated as new iframe/script origins appear.

**Exit criteria (8.1):** You can assemble pages comparable to the **richest `Whiteboard.html` / `InsertModal` mock** for the types you personally need weekly, with stable autosave and no “second app” for math/code/PDF reference.

#### B — Ink & input polish

- Pointer Events **`pressure` → stroke width** (and sensible fallback for mice).
- Eraser + highlighter edge cases, large stroke counts, and **stylus/tablet** scrolling quirks on chrome layers (`touch-action`, focus).
- Toolbar/dock parity when a **following** page has focus (undo depth, text styling, insert routing—complete any remaining gaps).

#### C — Notebook shell & navigation

- Notebook overview / TOC: scrolling, reorder, delete—continue hardening for pen + keyboard.
- Search (titles first; full-text later) when notebook count grows.
- Optional: pinned notebooks, templates—after core content types land.

#### D — Solo reliability

- CI on PR (typecheck + lint + tests) if not already enforced in your remote.
- Staging deploy path when you leave pure-local dev.
- Backup/export story: browser print today; **async PDF** (old Phase 6) after 8.1 feels solid.

---

### 8.2 Phase 0 — Foundations — **largely complete** in repo

| Deliverable | Status |
|-------------|--------|
| Next.js App Router + TypeScript strict | Done (`apps/web`) |
| Postgres + migrations | Done (**Drizzle** + `db:push` workflow; see README) |
| Auth in dev | Done (**Better Auth**; configure providers in env) |
| Design tokens from prototypes | Partial—ongoing alignment with `design-system.html` |
| CI: typecheck + tests on PR | **Open** (wire in your host; scripts exist in `package.json`) |

---

### 8.3 Phase 1 — Notebook OS + single-player ink — **substantially complete**

Deliverables from the original Phase 1 are mostly shipped (see §1.2). Remaining work is captured in **§8.1–8.1D** (embeds, pressure ink, focus routing, CI)—not a separate “Phase 1b” document.

---

### 8.4 Deferred track — Publishing, annotations, collaboration, platform (unchanged intent)

Execute **after** §8.1 exit criteria. Specs remain in §5–§7 and below.

| Original phase | Summary |
|----------------|---------|
| **Phase 2** — Read-only publishing | `share_links` rotation/revocation/passcode, public read hardening, watermark, ISR strategy |
| **Phase 3** — Private annotation forks | Student overlay model + revision rules |
| **Phase 4** — Live collaboration | Liveblocks rooms, tokens, checkpoints, teacher controls |
| **Phase 6** — Async PDF export | Worker + queue + `design-system-print.html` alignment |
| **Phase 7** — BYOK AI | Proxy, quotas, key storage |
| **Phase 8** — Voice narration | Per-page audio |
| **Phase 9** — PWA | Manifest, SW, offline shell |
| **Phase 10** — Tauri | Desktop shell |

**Note:** Original “Phase 5 (embeds)” is **merged into §8.1A** as the active priority—not after collaboration.

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

## 11. Immediate next tasks (notebook milestone)

Aligned with **§8.1** (not Phase 0 auth/ORM discovery—those choices are made).

1. **Image upload pipeline** — presigned PUT/POST to object storage, persist stable URLs in `image` blocks; drag/drop on canvas.
2. **KaTeX block** — block schema + renderer + editor affordance (inline vs block equations as you prefer).
3. **Code block** — block schema + highlighter + monospace layout.
4. **Wire insert + `/` to active page** — primary vs following sheet focus (toolbar, dock, slash).
5. **Ink pressure** — map `PointerEvent.pressure` into stroke width curve; document behavior in `STROKE_SCHEMA_V1.md` if point format changes.
6. **CI** — GitHub Actions (or equivalent): `typecheck`, `lint`, `test` for `apps/web` on each PR.
7. **Staging + Neon** (when ready) — optional before solo use is perfect; required before public beta.

---

## 12. Glossary

- **Checkpoint** — persist Liveblocks session state into durable storage controlled by Slate
- **BYOK** — bring your own API key (teacher-provided)
- **Mode A/B/C** — read-only / annotate / live (this document §1.8)

---

## Document control

- **Owner:** engineering lead (you)
- **Update cadence:** after each milestone retrospective
- **Version:** 1.1 — refocus on solo notebook + whiteboard; implementation snapshot; deferred collaboration track

### Implementation snapshot (`apps/web`)

- **[`README.md`](../README.md)** — local Postgres (`docker compose`), env vars, `db:push`, dev server
- **Stack:** Next.js (App Router) + **Drizzle** + **Better Auth** + dashboard **notebook / section / page** CRUD
- **Page editor:** backgrounds including **Cornell**, **page sizes** (`16_10`, `a4`, `letter`, `infinite`), ink autosave to **`strokesData`**, blocks in **`blocksData`** (text, YouTube, `https` image, rough shapes)
- **Tools:** laser, move/pan, select, text, shapes; **following pages** in the section editable below the current page
- **Themes:** `user_settings` → `data-theme` on `<html>`
- **Stroke schema:** [`docs/STROKE_SCHEMA_V1.md`](STROKE_SCHEMA_V1.md)
- **Share:** basic **`/share/[token]`** read path + `share_link` table exist for early use; **not** the current execution focus (see §8.4)
