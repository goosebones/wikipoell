# Wikipoell rebuild — plan

A new webapp, written from scratch against the new database (`SCHEMA.md`). It is built in milestones. Each milestone is split into chunks, and the app works after every chunk. Each chunk is reviewed before the next one starts.

The old app keeps running in production, on the old cluster, until the cutover milestone.

## Ground rules

- **Plain, short code.** No defensive wrappers, no tests, no abstractions written for later.
- **Every file opens with a 2–3 sentence comment** saying what it does. Longer for big or central files. For components, the comment also lists the props.
- **Mobile first.** Every screen is designed at phone width first, then widened.
- **Server first.** Pages are Server Components that read the database directly. Writes are Server Actions. Client components are used only where interaction needs them.
- **State lives in the URL.** Filters, sort, view mode and pagination are search params, so every view can be linked.

## Look and feel

Direction **A · Gallery** from the mockups:
- white, airy and image-led
- Inter for text, JetBrains Mono for codes and small labels
- thin dividers and almost no chrome
- 3:4 photos with a slow zoom on hover

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19 | Server Components and Server Actions; API routes only for webhooks and, later, ingest |
| Language | TypeScript, kept light | Mostly inferred types; one `types.ts` for the documents |
| Auth | Clerk (`@clerk/nextjs` 7) | Admin is `publicMetadata.role === "admin"`, as today |
| Database | MongoDB, official `mongodb` driver | No Mongoose. The cluster's validators (`scripts/setup-db.mjs`) already enforce document shape |
| UI | Tailwind CSS 4 + shadcn/ui | Components are copied into the repo (Radix underneath) and restyled to match A. Icons from `lucide-react` |
| Input validation | Zod, only at Server Action boundaries | |
| Images | Cloudflare R2 (`@aws-sdk/client-s3`) + `sharp` | Only for admin uploads (homepage backgrounds). Garment images come from the pipeline. Existing URLs keep working |
| Analytics | `@vercel/analytics`, `@vercel/speed-insights` | As today |
| Hosting | Vercel | Same project, with the root directory switched to `web/` at cutover |
| Tooling | ESLint (`eslint-config-next`) + Prettier | Same house style as today |

## Where it lives

`web/`, inside this repo, next to the old app, `SCHEMA.md`, `scripts/` (seed and migration) and `wikipoell-ingest/`.

```
web/
  app/                    routes: pages, layouts, server actions
  components/             UI; components/ui/ holds the shadcn primitives
  lib/
    db.ts                 connection + typed collections
    vocabulary.ts         loads all vocabulary in one cached call
    tree.ts               tree helpers: subtree query, ancestors, label path
    garments.ts           garment queries
    garment-display.ts    derived title and article code (pure, client-safe)
    article-code.ts       parses a pasted article code (decoder, search)
    auth.ts               current user, isAdmin
    r2.ts                 image upload
  types.ts
```

## Features

What the new site will have, from the feature review.

**Browsing**
- Homepage built around a prominent search. The search itself gets reworked under the hood (milestone 11).
- Header dropdown menus for category, model, color and material.
- Pages for each kind of attribute: `/category/...`, `/model/...`, `/color/...` and `/material/...`. Each shows everything in it and below it, plus an index page listing all values with counts.
- Model pages with a material × color variant matrix.
- A codebook: reference pages for types, procedures, processes, materials (with composition) and colors.
- An article code decoder.
- Filters driven by the URL: tree filters with counts for category, color and material, and lists for the rest.
- Sorting, a grid/list view toggle, and pagination.
- Garment page: image gallery with a zoomable lightbox, the article code, and every attribute linking to its page, plus where the garment was listed.
- Similar garments, in sections:
  - exact matches (same model, material and color)
  - other colors of the same model
  - other materials of the same model
  - same category
- 404 page.

**Accounts**
- Sign in with Clerk, and user sync through the webhook.
- Profiles showing a user's favorites and owned pieces.
- Favorites, and "I own this" (with a public or private choice for owned pieces).
- Suggest a correction to a garment's fields, or to vocabulary data such as a fabric's composition. Suggestions go to the admin queue.

**Admin**
- Edit any garment.
- Review queue: pending garments and correction suggestions, with values that don't exist yet addable inline.
- Ingest review details on pipeline garments, ingest runs with unpublish-by-run, and the re-check queue.
- Vocabulary editor for every collection, with tree editing.
- Bulk edit.
- Data quality dashboard.
- Homepage backgrounds screen.

**Site**
- Link previews and SEO: page titles, Open Graph images and a sitemap.
- Vercel analytics.

**Maybe, later:** grouping listings of the same garment across retailers; a "recently added" feed.

**Dropped:**
- user uploads (garments come only from the ingest pipeline)
- owner editing (admins edit instead)
- adding photos to existing garments, edit history, and merging duplicates
- random garment, color swatches, dark mode, and the about page

**New collections this needs:**
- `userGarments`: `{ userId, garmentId, kind: "favorite" | "owned", public, createdAt }`, unique on user + garment + kind.
- `suggestions`: `{ userId, target: { collection, id }, field, current, proposed, note, status, createdAt }`.

Both are added to `scripts/setup-db.mjs` in the milestone that introduces them.

## Milestones

Each milestone ends with a working site. Each numbered chunk is one review.

### 1. Scaffold
1. Next.js + TypeScript + Tailwind, with Prettier and ESLint configured. A blank page runs.
2. shadcn/ui and the A design tokens: fonts, colors, spacing.
3. Root layout (mobile first): header, footer, empty home page and 404.

### 2. Auth
1. Clerk provider, with sign-in and sign-out in the header.
2. `isAdmin()` helper, and an `/admin` page that only admins can open.

### 3. Data layer
1. Database connection, plus `types.ts`.
2. Vocabulary loader and tree helpers.
3. Display helpers (derived title, article code). The home page shows live counts as a smoke test.

### 4. Garment grid
1. `/garments`: published garments as cards.
2. Pagination.
3. Sorting, and the grid/list toggle.

### 5. Garment page
1. Title, article code and attributes, with tree values as full paths, each linking to its page.
2. Image gallery and lightbox.
3. Source listing.

### 6. Navigation
1. Header dropdowns for category, model, color and material.
2. A mobile menu sheet holding the same menus.

### 7. Attribute pages
1. `/category/[...path]` with breadcrumb.
2. `/color/[...path]` and `/material/[...path]`, with the label, code and description.
3. `/model/[id]`, with the variant matrix.
4. Index pages `/category`, `/color`, `/material` and `/model`, listing every value with counts.

### 8. Filters
1. Filter panel driven by the URL: lists for model, type, gender, procedure and process.
2. Tree filters for category, color and material.
3. Counts next to each option, and the mobile filter sheet.

### 9. Similar garments
1. Sectioned similar garments on the garment page: exact matches, other colors, other materials, same category.

### 10. Codebook and decoder
1. Codebook pages for types, procedures and processes; color and material pages already cover the rest.
2. `article-code.ts` (a port of the pipeline's parser) and a `/decode` page that explains a pasted code and links to matching garments.

### 11. Home and search
1. Homepage with a rotating background and the search front and center.
2. Search back end. **Proposal:** search entities rather than garment titles. A query matches models (number and name), vocabulary (codes and labels) and decoded article codes, and results lead to those pages. Atlas Search is an option if fuzzy matching is wanted. To be decided at this point.
3. Type-ahead results UI.

### 12. Users
1. Clerk webhook keeping `users` in sync.
2. `/user/[username]` profile page.

### 13. Favorites and owned
1. `userGarments` collection, plus favorite and own buttons on garments.
2. Profile sections for favorites and owned pieces, with the public/private setting.

### 14. Suggest a correction
1. `suggestions` collection, plus a suggest form on garment pages.
2. The same form on vocabulary pages (e.g. a material's composition).

### 15. Admin: garment editing
1. Tree picker component (colors, materials, extras, categories) and a model picker that fills in the category.
2. An edit screen for any garment, opened from its page.

### 16. Admin: review queue
1. Pending garments: publish (which needs a model) and reject.
2. Inline "add missing value" while reviewing.
3. Correction suggestions: accept, which applies the change, or dismiss.

### 17. Admin: vocabulary
1. Flat lists: types, genders, procedures, processes.
2. Models: add, rename, set suggested category.
3. Tree editor for colors, materials, extras and categories: add, rename, move.

### 18. Admin: bulk edit and data quality
1. Data quality dashboard: no material or color, single-layer values, category differing from the model, models with no garments.
2. Bulk edit: select garments and set a field on all of them.

### 19. Admin: backgrounds
1. R2 upload, and a backgrounds screen: add, remove, toggle active.

### 20. Admin: ingest views
1. Ingest details (reasons, field confidence, LLM notes) on review cards, from existing data.
2. Runs page with unpublish-by-run.

### 21. SEO and analytics
1. Metadata and Open Graph images for garment, model and attribute pages.
2. Sitemap, plus Vercel analytics and speed insights.

### 22. Cutover
1. Re-run `migrate-garments.mjs --apply --replace` to bring the latest edits across.
2. Point Vercel at `web/` with `MONGODB_URL` set to the new cluster.
3. Check production, then delete the old app.

### After cutover: ingest pipeline rework
Planned separately. It brings back the `/api/ingest/*` routes and the re-check queue, and decides what happens to agent corrections. The pipeline stays paused from cutover until then.
