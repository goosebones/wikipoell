# Wikipoell — plan

Work still ahead, now that the rebuilt site is live.

## MCP server

The server is public and read-only, so it needs no auth. Site search finds entities (models, materials, colors, codes) rather than garments. `find_garments` is therefore the tool assistants will lean on most, and `search` helps them find the ids to filter by.

1. A read-only MCP endpoint at `/api/mcp` (Streamable HTTP, in a route handler). Its tools wrap existing lib functions:
   - `search` (`lib/search.ts`)
   - `find_garments` (`getGarmentCards`, with the filter format from `lib/filters.ts`)
   - `get_garment`
   - `similar_garments` (`getSimilarGarments`)
   - `decode_article_code` (`lib/article-code.ts`, plus the count of matching garments)
   - `codebook` (types, procedures, processes)

   Responses stay compact: ids, titles, codes and URLs.

2. Rate limiting for the public endpoint, and a short "Use with AI assistants" note on the codebook page explaining how to connect.

## Ingest pipeline rework

The pipeline (`wikipoell-ingest/`) has been paused since the rebuild. It still talks to the old app's `/api/ingest/*` routes, which no longer exist, and writes vocabulary codes (`ROOMS`, `010`) where the new schema stores node ids (`leather.kangaroo.rooms`, `black.010`). The archive's newest garment is from 2026-09-24.

### Decisions

- **Python writes directly to MongoDB and R2.** The old rule that "Python never touches the database" existed so Mongoose could stay the one definition of a garment. Mongoose is gone, and the database validators (`scripts/setup-db.mjs`) now enforce the shape. Writing directly means:
  - no API to rebuild;
  - no webapp running during a run;
  - no image conversion on Vercel's CPU.
- **Run by hand for now.** It runs from your Mac, against `pinch-seam` first and then `spur-biter`. A scheduled GitHub Action comes later, once runs look clean.
- **Keep the LLM pass.** Its worked examples come from garments a person has already corrected: what the pipeline read (`ingest.review.fields`) versus what was saved. This replaces the deleted agent corrections without a new collection.

### What stays

- **Sources:** the nine source modules and `RawListing`. Each module turns a site into listings and does no classification.
- **Parsing:** the article-code parser and its vocabulary-aware fixes (dashed materials, ambiguous procedures, color padding).
- **Routing:** the same reason strings. The review queue (`lib/review.ts`) already reads `unknown_vocab:<field>=<value>`, `code_unparseable:<raw>`, `unknown_category` and `llm_low_confidence:<n>`.
- **Run records and garment metadata:**
  - each run writes one `ingestruns` document, in the shape `/admin/runs` reads, and stamps its `runId` on every garment it touches;
  - the existing `ingest.*` fields are kept;
  - "unpublish by run" keeps working unchanged.
- **The update policy for human-reviewed garments:** only `lastSeenAt`, `contentHash`, `lastRunId` and new images are written, and fields are never touched. Images are deduplicated on `sourceUrl`, and none are added to a garment whose older images have no `sourceUrl`.
- **Existing garments are recognised.** All 1,961 have `ingest.source`, `siteKey` and `contentHash`, and 702 are human-reviewed, so the first run touches what it already knows and only creates what's new.

### What changes

1. **Store (`ingest/store.py`, replacing `client.py`):**
   - `pymongo` for garments and runs;
   - `boto3` for the garment bucket;
   - `Pillow` for WebP conversion (quality 85, at most 2560 px, as the app does), keyed `<imageGroupId>/<uuid>.webp`.

   The create, update, touch and run methods keep the client's names, so `runner.py` barely changes. The database rejects any document that breaks the validator, and that listing is recorded as a failure.

2. **Vocabulary (`normalize/vocabulary.py`):**
   - Load `types`, `genders`, `procedures`, `processes`, `materials`, `colors`, `models` and `categories` directly.
   - Build a code → id index per field; every code is unique within its collection. Parsing still reads codes, and the draft is translated to ids before writing.
   - A code with no node becomes `unknown_vocab:<field>=<code>`, which the queue shows as "Retailer wrote: …".
3. **Models are required.** An unknown model number goes to a person (`unknown_vocab:model=<n>`), who adds it from the review queue's model box.
4. **Category comes from the model.** When the model is known, its `suggestedCategory` is the category, at high confidence. The keyword rules and site hints only fill in when the model is unknown.
5. **Titles aren't stored.** The title is the model's label (`overrideTitle` stays null). The listing's own title is kept in `ingest.review.fields.title`, which the queue shows as "Listed as" and which helps when naming a new model. `title_unformatted` and most of `title.py` go.
6. **Required to publish:** `model` (which must exist), `type`, `gender`, `material` and `category`, plus `color` except for jewelry. Procedure, process and extras are optional.
7. **Extras from keywords.** Match extras labels (rubber drip, prosthetic, spur biter…) in the title and description, at title confidence; extras never block publishing. A one-off `backfill-extras` command applies the same matching to existing garments, which today have none. It skips human-reviewed garments, or asks first.
8. **Cache refresh.** One new app route, `POST /api/revalidate` (bearer `REVALIDATE_TOKEN`), runs `revalidateTag("garments", { expire: 0 })`. A real run calls it once at the end, so new garments show at once instead of after the hourly cache.
9. **LLM prompt.** It's built from the new vocabulary (codes with labels) and the worked examples above. The JSON output maps to ids the same way the parser's output does.

### Phases

| Phase     | Scope                                                                                                                                                                                                                                             | Done when                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**     | App: `/api/revalidate` and its env. Ingest: `.env` rework (`MONGODB_URL`, `INGEST_DB`, garment R2 keys, `OPENROUTER_API_KEY`, `SITE_URL`, `REVALIDATE_TOKEN`), the store, vocabulary loading with code → id, models required, category from model | `python -m ingest run ccp-room --dry-run --no-llm` against `pinch-seam` routes every listing sensibly, and existing garments show as unchanged |
| **2**     | Real writes and images against `pinch-seam`, then one source with `--limit` on `spur-biter`                                                                                                                                                       | New garments appear on the site with photos, and `/admin/runs` shows the run                                                                   |
| **3**     | LLM pass on the new vocabulary, with examples from corrected garments                                                                                                                                                                             | Held-back listings arrive in the queue with sensible drafts and notes                                                                          |
| **4**     | Extras matching, and the `backfill-extras` command                                                                                                                                                                                                | Extras show on garments and filter correctly                                                                                                   |
| **5**     | All nine sources on `spur-biter`; README and DESIGN.md rewritten to match                                                                                                                                                                         | A full run completes and the queue is manageable                                                                                               |
| **Later** | A scheduled GitHub Action; a `recheck` command that publishes pending garments once their blockers exist (in place of the old re-check button)                                                                                                    | —                                                                                                                                              |

## Revisit

- **Sort options.** Newest, model and title exist today (`SORTS` in `lib/garments.ts`). Title and model may not be very useful, so choose which sorts to offer.

## Maybe, later

- Grouping listings of the same garment across retailers.
- A "recently added" feed.
- "I own this": marking owned pieces, with a choice of showing them on your profile.
