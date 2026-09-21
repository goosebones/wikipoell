# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wikipoell is a community-driven archival and documentation platform for Carol Christian Poell's clothing designs. Users submit garments with images and metadata, browse by category, and filter by properties. Submissions land in a `pending` queue and an admin publishes them — optionally with help from a Claude-backed review agent.

## Commands

```bash
npm run dev           # Dev server: Turbopack, HTTPS, port 443
npm run build         # Production build
npm run start         # Serve the production build
npm run lint          # eslint .
npm run lint:fix      # eslint . --fix
npm run format        # Prettier write
npm run format:check  # Prettier check
```

Dev runs HTTPS on port 443 (`--experimental-https`); certs live in `certificates/`.

To serve dev under a hostname other than `localhost`, set `DEV_ORIGIN` in `.env` — `next.config.ts` passes it to `allowedDevOrigins`. Local-machine setup (hosts file, certificates) stays out of the repo.

No test suite exists in this project. `npm run build` is the main correctness gate — run it after non-trivial changes.

## Tech Stack

- **Framework**: Next.js 16 (App Router). TypeScript is configured, but source is mostly `.js`/`.jsx`.
- **UI**: Mantine v8 + Tailwind v4 (via `@tailwindcss/postcss`) + Lucide icons
- **Database**: MongoDB via Mongoose
- **Auth**: Clerk (`@clerk/nextjs`)
- **Storage**: Cloudflare R2 (via `@aws-sdk/client-s3`)
- **Image processing**: Sharp (converts uploads to WebP before R2 storage)
- **LLM**: reached by `wikipoell-ingest/` over OpenRouter, never at request time. (`@anthropic-ai/sdk` remains only for the frozen script in `wikipoell-ingest/legacy/`.)

## Code Style

Prettier is authoritative and `.prettierrc` sets **`singleAttributePerLine: true`** — JSX puts one attribute per line. This is the house style; without that config Prettier's defaults collapse it and produce a very large spurious diff. Run `npm run format` before committing.

ESLint uses flat config (`eslint.config.mjs`) built on `eslint-config-next/core-web-vitals` and `/typescript`. Note `next lint` no longer exists in Next 16 — the scripts call `eslint` directly.

## Architecture

### Routes

```
app/
  page.jsx                      homepage (search + random background)
  garment/                      listing, [slug] detail, create
  category/[...slug]/           nested category browsing + filtering
  user/[...slug]/               public user profiles
  admin/                        admin-only, gated by app/admin/layout.jsx
    page.jsx                    review queue (user + pipeline submissions)
    runs/page.jsx               ingest run history + unpublish
    properties/page.jsx         property management
  api/
    garment/, garment/[id]/     create / patch (owner-scoped)
    image-upload/               Sharp → WebP → R2
    properties/                 property list
    search-suggestions/         homepage typeahead
    webhooks/clerk/             user.created/updated/deleted → MongoDB
    admin/*                     admin-only mutations
    ingest/*                    service-token API for wikipoell-ingest (see below)
```

`proxy.ts` at the repo root is the Next 16 middleware file (renamed from `middleware.ts`); it just wires up `clerkMiddleware()`.

`wikipoell-ingest/` sits alongside these but is not webapp source — see below.

### Global state

`app/layout.jsx` fetches properties and categories server-side and injects them via `PropertiesProvider` and `CategoriesProvider` (`components/context/`). Client components read them with `useProperties()` / `useCategories()` rather than refetching — `CategoryTreeSelectClient`, for example, needs no `categories` prop.

Both `getProperties()` and `getCategories()` are wrapped in React `cache()`, so repeated calls within one request hit MongoDB once.

### Auth and admin gating

Clerk handles auth. Admin access is a Clerk session claim: `sessionClaims.metadata.role === "admin"`.

This is checked in **two independent places**, and both are required — `app/admin/layout.jsx` (redirects non-admins to `/`) and every route under `app/api/admin/` (returns 403). The layout does not protect the API.

### Data model

`models/` holds the Mongoose schemas:

- **`Garment`** — `status: pending | published | rejected` drives the review queue. `procedure` is `Mixed`: legacy documents store a string, newer ones a `string[]`; use `normalizeProcedure()` from `lib/patch-garment.js` rather than assuming either. `source` is `{ type: "me" | "external", label, url }`.
- **`User`** — synced from Clerk webhooks.
- **`HomepageBackground`** — rotating homepage imagery.
- **`AgentCorrection`** — records what an admin actually changed on a pipeline garment, keyed uniquely by `garmentId`. Written by `lib/agent-corrections.js` from the admin PATCH, and consumed as few-shot examples by the pipeline's LLM pass. This is the loop that makes classification improve over time.
- **`IngestRun`** — one per pipeline invocation; its `_id` is the `runId` stamped on every garment that run created or touched.

`Garment.ingest` is a subdocument present only on pipeline-originated garments: `source`, `siteKey` (unique per source — partial index), `contentHash`, `runId`/`lastRunId`, `firstSeenAt`/`lastSeenAt`, `humanReviewedAt`, and `review` (why it was routed to a person, with per-field confidence). **Any admin PATCH sets `ingest.humanReviewedAt`**, and from then on the pipeline may only refresh `lastSeenAt` and append images — enforced in `lib/ingest-garments.js`, not trusted from the client.

`Category` and `Property` are defined inline in `lib/categories.js` and `lib/properties.js`, not in `models/`.

### Properties system

The `Property` collection is the vocabulary for every garment field. Each row maps `garmentKey` (e.g. `material`) → `garmentValue` (e.g. `ROOMS`) with a human-readable `description`. It drives every select, the filter menu, and the "unknown value" warnings in admin review.

`Property._id` is a string — `crypto.randomUUID()` for new rows, legacy ObjectId hex for old ones. Use `propertyByIdFilter(id)` to match either.

Garment codes are rendered from these fields by `getGarmentCode()` as two lines: `<type><gender>/<model>[-procedure]` and `<material>[-process]/<color>`.

### Category system

Categories are hierarchical via a `parent` reference and dot-delimited ids (`footwear.boots`). `app/category/[...slug]/` is a catch-all handling nested browsing and filtering; category matching is a `^` prefix regex, so `footwear` also returns `footwear.boots`.

### Review queue

`/admin` is the single queue for everything pending, from users and from the pipeline alike. Pipeline garments additionally render `ingest.review`: why they were held back, each field's confidence and where it was read from, the source listing, and the LLM's notes (`components/admin/ingest/`).

The filter bar ranks the queue's blockers by how many garments share each one, so a single missing property value that accounts for dozens of garments can be fixed once rather than hunted down individually. Filters are server-side via `getAdminQueue({ reason, source })`.

Publishing or editing sets `ingest.humanReviewedAt` **and** writes an `AgentCorrection` — the pipeline then leaves that garment's fields alone forever, and the correction becomes a training example.

**Re-check queue** on `/admin` re-tests the blockers recorded on pending garments against the _current_ vocabulary and publishes anything nothing blocks any more (`lib/ingest-reevaluate.js`). Most of the queue is held up by property values that do not exist yet, so adding one can clear dozens at once. It previews first and requires confirmation, never runs the LLM or re-scrapes, skips garments you have edited, and stamps its work with an `IngestRun` so it is revertible like any other run. Reasons it resolves are preserved as `ingest.review.clearedReasons`.

`/admin/runs` lists run history with per-source counters and errors, and carries the **unpublish-by-run** button: every garment stamps the `runId` that created it, so a bad run moves back to `pending` in one action. Nothing is deleted.

### lib/

| File                                           | Purpose                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `mongodb.js`                                   | Module-level cached connection (`initMongo()`), avoids reconnecting per invocation    |
| `garments.js`                                  | Garment queries incl. `getAdminQueue()` and `getSimilarGarments()` (weighted scoring) |
| `garment-utils.js`                             | **Pure** helpers — safe to import from client components, must never import Mongoose  |
| `properties.js` / `categories.js`              | Schemas and cached fetchers                                                           |
| `patch-garment.js`                             | Shared garment PATCH logic, with separate owner/admin field allowlists                |
| `admin-garment-properties.js`                  | Admin review field metadata and unknown-value detection                               |
| `ingest-review.js`                             | Renders `ingest.review` reasons/confidence for the admin queue                        |
| `ingest-runs-admin.js`                         | Run history and unpublish-by-run                                                      |
| `agent-corrections.js`                         | Records admin edits as few-shot examples                                              |
| `r2.js`, `users.js`, `homepage-backgrounds.js` | R2 upload, Clerk user lookups, homepage imagery                                       |

`garment-utils.js` exists specifically so client components can compute garment codes without pulling server-only code into the bundle — keep it dependency-free.

### Images

`next.config.ts` sets `images.unoptimized: true`, so `next/image` here is about layout and consistency, not optimization. Remote hosts must still be listed in `remotePatterns` (R2 public URLs plus `thelibrary1994.com`) or images fail to render.

Uploads go client → `/api/image-upload` → Sharp (WebP, quality 85) → R2 under `<imageGroupId>/<uuid>.webp`. Max 10 MB; JPEG, PNG, GIF, and WebP accepted.

## wikipoell-ingest/

Scraping, importing, and the agent review pass live in `wikipoell-ingest/` — a separate hand-run project that happens to share this repo. It has **its own `README.md`; read that before touching anything in there.**

It is not part of the webapp: nothing under `app/`, `components/`, or `lib/` imports from it, it is excluded from `tsconfig.json`, and it never runs during a request or a build. It shares this repo only because it uses the same MongoDB, the same R2 bucket, and this project's root `.env`.

```bash
cd wikipoell-ingest
npm run ccp-room:scrape
npm run ccp-room:import -- --dry-run
npm run agent-review -- --deterministic
```

The coupling that does matter runs through the database: `agent-review` writes the `AgentProposal` documents that `/admin/agent` renders, so changing the proposal shape means changing `components/admin/agent-proposal/` too.

### Ingest API (`/api/ingest/*`)

The new pipeline (see `wikipoell-ingest/DESIGN.md`) never touches MongoDB directly; it talks to these routes. Auth is a shared bearer token, `INGEST_API_TOKEN` — compared in constant time by `lib/ingest-auth.js`, failing closed (503) if unset. Nothing else accepts it, and these routes accept nothing else. Every route is wrapped by `ingestRoute()` in `lib/ingest-route.js`, which does the token check, `initMongo()`, and maps typed errors (`IngestValidationError` → 400, `IngestConflictError` → 409) to responses.

| Route                              | Purpose                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/ingest/context`          | Properties, categories, 50 most recent `AgentCorrection`s, system user id — one call at run start        |
| `GET /api/ingest/garments?source=` | Dedup index: `{ id, siteKey, contentHash, status, humanReviewedAt }` per garment of that source          |
| `POST /api/ingest/garments`        | Create; body `{ publish, fields, images, imageGroupId, source, ingest }`. Server sets status + uploader  |
| `PATCH /api/ingest/garments/:id`   | Re-scrape update, policy enforced server-side; status only ever moves `pending → published`              |
| `PATCH /api/ingest/garments/touch` | Batch `lastSeenAt` bump, `{ runId, ids }`                                                                |
| `POST /api/ingest/runs`            | Open a run → `runId`                                                                                     |
| `PATCH /api/ingest/runs/:id`       | Progress; a terminal `status` sets `finishedAt`/`durationMs`. `sources`/`totals`/`failures` are replaced |
| `POST /api/ingest/images`          | Multipart → WebP → R2, via the same `lib/garment-images.js` path user uploads use                        |

`uploadedByUserId` on pipeline garments is always `INGEST_SYSTEM_USER_ID` from env. (The user-facing `POST /api/garment` likewise takes it from the Clerk session now, never the body.)

`scripts/migrate-ingest.mjs` (`npm run migrate:ingest`, `--apply` to execute) is the one-off that backfills `ingest` onto the 469 published garments and deletes the 346 pending ones. It refuses to run if those counts have changed.

The webapp's tooling ignores it wholesale — `tsconfig.json` excludes it, and so do `eslint.config.mjs` and `.prettierignore`. It carries its own `eslint.config.mjs` and `.prettierignore` instead, with its own `lint`/`format` scripts, because its rules answer to plain Node rather than React/Next. **Lint and format it from inside that directory**; the root scripts do not reach in.

## Environment Variables

See `.env.example`:

- `MONGODB_URL`
- `R2_TOKEN_VALUE`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_S3_API_URL`, `R2_PUBLIC_URL`, `R2_BACKGROUND_PUBLIC_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`
- `ANTHROPIC_API_KEY` — only for the frozen `wikipoell-ingest/legacy/agent-review/` script. The live pipeline reads `OPENROUTER_API_KEY` from its own `.env`.
- `INGEST_API_TOKEN`, `INGEST_SYSTEM_USER_ID` — the `/api/ingest/*` service token and the Clerk user pipeline garments are attributed to

`R2_PUBLIC_URL` and `R2_BACKGROUND_PUBLIC_URL` are read at build time by `next.config.ts` to construct `remotePatterns`, so the build needs them set.

## Path Aliases

`@/*` maps to the project root (`tsconfig.json`). Use `@/components/...`, `@/lib/...`, `@/models/...`.
