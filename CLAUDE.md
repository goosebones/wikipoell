# CLAUDE.md

Guidance for Claude Code in this repository.

@AGENTS.md

## Project

Wikipoell is an archive of Carol Christian Poell's garments: browse and filter
by the attributes his article codes encode (type, gender, model, procedure,
material, process, color), plus category and extras. Signed-in users keep
favorites and suggest corrections; admins review, edit and curate.

- `PLAN.md`: the rebuild's milestones and decisions.
- `SCHEMA.md`: the database, collection by collection.

## Commands

```bash
npm run dev           # Dev server, http://localhost:3000
npm run build         # Production build, the correctness gate
npm run lint          # eslint .
npm run format        # Prettier write
npx next typegen      # Regenerate route types (PageProps) after adding routes
```

There are no tests. Run `npm run build` after non-trivial changes.

## Stack

- Next.js 16 (App Router, `cacheComponents`), TypeScript, React 19.
- Tailwind v4 (via `@tailwindcss/turbopack`), shadcn components in `components/ui/`, Lucide icons.
- MongoDB through the official driver (`lib/db.ts`), with no ORM.
- Clerk for auth. Admin means `publicMetadata.role === "admin"`, checked in `lib/auth.ts`.
- Cloudflare R2 (`lib/r2.ts`) for homepage backgrounds; garment images are public URLs.
- Vercel Analytics and Speed Insights.

## Code style

- Keep code simple and short: no defensive helpers and no tests.
- Every file opens with a 2–3 sentence comment saying what it is. UI components also list their props.
- Components draw finished data. Shape the data in `lib/`, with no lookup tables, casts or render closures in components.
- Public pages are mobile first; admin pages are designed for desktop.
- Prettier is authoritative (`singleAttributePerLine: true`).

## Architecture

- **Caching:**
  - Pages and data are `"use cache"` with `cacheLife`/`cacheTag`. Tags are `garments`, `garment:<id>`, `vocabulary` and `backgrounds`.
  - Server actions refresh with `updateTag`; route handlers use `revalidateTag(tag, { expire: 0 })`.
  - Per-request reads after Clerk's `auth()` call `connection()` first.
- **Vocabulary:**
  - `lib/vocabulary.ts` loads every vocabulary collection.
  - Trees (categories, colors, materials, extras) use dot-path ids. Helpers live in `lib/tree.ts`.
  - Moving a node re-ids its subtree and every reference in one transaction (`db.withTransaction`).
- **Filters:** URL search params, parsed and turned into queries by `lib/filters.ts`.
- **Admin (`app/admin/`):** review queue, vocabulary editor, data quality, bulk edit, backgrounds and ingest runs. All mutations are in `app/admin/actions.ts`, and every one checks admin.
- **Webhooks:** `app/api/webhooks/clerk` syncs users to the `users` collection.
- **SEO:** `lib/seo.ts`, `app/sitemap.ts` and `app/robots.ts`.

## Databases

They live in the `carols-vision` Atlas cluster:

- `spur-biter` is production.
- `pinch-seam` is development; `.env.local` points here.
- `wikipoell` is the old app's database. Never write to it.

`scripts/setup-db.mjs` creates collections, validators, indexes and seeds. `scripts/migrate-garments.mjs` migrated the old data. Both take `--db`.

## wikipoell-ingest/

The scraping and ingest pipeline is a separate project that shares this repo and the root `.env`. Read its `README.md` before touching it. The app's tsconfig, eslint and prettier all ignore it.

## Environment

See `.env.example`. Locally the app reads `.env.local`; the root `.env` belongs to `wikipoell-ingest/` and the scripts.
