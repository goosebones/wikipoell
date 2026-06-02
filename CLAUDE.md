# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wikipoell is a community-driven archival and documentation platform for Carol Christian Poell's clothing designs. Users can submit garments with images and metadata, browse by category, and filter by properties.

## Commands

```bash
npm run dev        # Start dev server with Turbopack
npm run build      # Production build
npm run lint       # ESLint
npm run lint:fix   # ESLint with auto-fix
npm run format     # Prettier format
npm run format:check  # Check formatting without writing
```

No test suite exists in this project.

## Tech Stack

- **Framework**: Next.js (App Router) with TypeScript config but mostly `.js`/`.jsx` files
- **UI**: Mantine v8 + Tailwind v4 (via `@tailwindcss/postcss`) + Lucide icons
- **Database**: MongoDB via Mongoose
- **Auth**: Clerk (`@clerk/nextjs`)
- **Storage**: Cloudflare R2 (via `@aws-sdk/client-s3`)
- **Image processing**: Sharp (converts uploads to WebP before R2 storage)

## Architecture

### App Router Structure
- `app/` — pages and layouts using Next.js App Router
- `components/` — shared React components
- `lib/` — utilities for MongoDB connection, R2 uploads, garment/category helpers
- `models/` — Mongoose schemas (Garment, User, HomepageBackground)

### Data Flow
1. **Global state**: `app/layout.js` fetches properties and categories server-side, then injects them via `PropertiesProvider` and `CategoriesProvider` context (in `components/`).
2. **Auth**: Clerk handles auth; a webhook at `app/api/webhooks/clerk/route.js` syncs `user.created/updated/deleted` events into MongoDB.
3. **Image uploads**: Client POSTs to `/api/image-upload` → Sharp converts to WebP → uploaded to Cloudflare R2 → public URL returned.
4. **Garment creation**: POST to `/api/garment` requires Clerk auth and writes a Mongoose `Garment` document.

### Category System
Categories are hierarchical with parent/child relationships stored in MongoDB. The `app/category/[...slug]/` catch-all route handles nested category browsing and filtering.

### MongoDB Connection
`lib/mongodb.js` uses a module-level cached connection to avoid reconnecting on every serverless invocation.

## Environment Variables

See `.env.example`. Required groups:
- `MONGODB_URL` — MongoDB connection string
- `R2_*` — Cloudflare R2 credentials and bucket config (`R2_TOKEN_VALUE`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_S3_API_URL`, `R2_PUBLIC_URL`, `R2_BACKGROUND_PUBLIC_URL`)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`

## Path Aliases

`@/*` maps to the project root (configured in `tsconfig.json`). Use `@/components/...`, `@/lib/...`, `@/models/...` for imports.
