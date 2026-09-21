# wikipoell-ingest — Design

A continuously running pipeline that discovers Carol Christian Poell garments on retailer sites, standardises them, and publishes them to Wikipoell — routing to a human only when it has to.

Status key: **DECIDED** — settled in discussion. **PROPOSED** — my design, needs a nod. **OPEN** — needs an answer before that part is built (none remain; see §12).

---

## 1. Principles

- **Stateless runs.** `python -m ingest run` does one pass and exits. All state lives in MongoDB. Any scheduler can invoke it; nothing is lost if it's killed. (DECIDED)
- **The webapp owns the schema.** Python never touches MongoDB. It talks to a service-authenticated `/api/ingest/*` namespace, so Mongoose stays the single definition of a garment. (DECIDED)
- **Every write is attributable to a run.** Each garment carries the id of the run that created it and the run that last touched it, so a bad run can be pulled off the site in one action. (DECIDED)
- **Humans decide vocabulary; the pipeline decides classification.** A value not in the `Property` collection always goes to a person. The pipeline never adds vocabulary. (DECIDED)
- **Ship sources one at a time.** ccp-room and The Library first, replacing the existing scrapers; the other seven follow as independent modules. (DECIDED)

## 2. What a garment is

A garment is one MongoDB document identified by `type + gender + model + procedure + material + process + color`. Sizes are not part of identity. (DECIDED)

Deduplication is **per site only**. The same article code on ccp-room and on The Library is two garments with two sources. There is no cross-site merging. (DECIDED)

Within a site, a listing is identified by a **site key** — a stable string the site itself provides, chosen per site when its module is written. For the two existing sources it is derived from `source.url`, because that is what the existing garments can be backfilled from (all have a unique one) — but the derivation differs, and the Python modules must match it exactly (DECIDED):

| Source        | Site key                            | Example                                     | Why                                                                                    |
| ------------- | ----------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ccp-room`    | URL **fragment**                    | `o-d-box-leather-parka-19`                  | Single-page catalog: every URL is `/catalog/#<slug>`, so the path is identical for all |
| `the-library` | URL **pathname**, no trailing slash | `/products/object-dyed-drip-rubber-sneaker` | Shopify handle                                                                         |

Both are unique across every existing garment (verified: 502 unique fragments, 313 unique paths).

Marketplace sites (Grailed, eBay) are out of scope for now. (DECIDED)

## 3. Sources

| Module        | Site                                            | Platform                | Fetch strategy                                                                    |
| ------------- | ----------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `ccp_room`    | ccp-room.com/catalog                            | custom, server-rendered | HTML, port of existing scraper                                                    |
| `the_library` | thelibrary1994.com                              | Shopify                 | `/products.json` — no HTML parsing, no Selenium                                   |
| `closetcase`  | closetcase.co/collections/ccp                   | Shopify                 | `/products.json`, shares a `ShopifySource` base                                   |
| `darklands`   | darklands.berlin/tiefgarage/… (men's + women's) | custom, server-rendered | HTML                                                                              |
| `bilzerian`   | alanbilzerian.com/carol-christian-poell         | BigCommerce             | HTML (Storefront API as a fallback)                                               |
| `ink`         | ink-clothing.com (men's + women's)              | custom, server-rendered | HTML                                                                              |
| `shelter2`    | shelter2.com                                    | Japanese hosted cart    | HTML; titles are Japanese, article codes are not — codes carry most of the signal |
| `lazzari`     | lazzariweb.it                                   | PrestaShop              | HTML; largest catalog of the group                                                |
| `thirdshed`   | thethirdshed.com/collection                     | WordPress / WooCommerce | HTML, or the public `/wp-json/wc/store/products` API                              |

All nine respond 200 to a plain request and render products server-side. No headless browser in the design. Sites with two entry URLs (darklands, ink) are one module with two start points, so gender comes from the entry point rather than being inferred.

**Politeness** (DECIDED as "be smart"): one request at a time per source, a configurable delay between requests (default 1.5 s), honour `Retry-After` on 429, and sources run sequentially. No user-agent spoofing — httpx's default identifies the client honestly, and all nine sources were verified to serve it normally. A source that throws is recorded as failed in the run and the run moves on.

### Source contract (PROPOSED)

```python
class Source(Protocol):
    name: str    # "ccp-room" — stored on the garment, used in the dedup index
    label: str   # "CCP-ROOM" — display label, matches existing source.label values

    def listings(self) -> Iterator[RawListing]: ...

@dataclass
class RawListing:
    site_key: str            # stable per-site id (SKU or URL path)
    url: str
    title: str
    sku: str | None
    article_code: str | None # verbatim, if the site shows one
    description: str | None
    images: list[str]        # absolute URLs, in display order
    gender_hint: str | None  # from the entry point, if the site splits by gender
    category_hint: str | None
    raw: dict                # anything else, for the LLM and for debugging
```

A module's whole job is to turn a site into `RawListing`s. It does no classification. This is what keeps modules small and independently replaceable when a site changes its HTML.

## 4. Pipeline per listing

```
RawListing
  │
  ├─ 1. dedup / change detection   (site_key + content hash against the run-start index)
  │       unchanged → touch lastSeenAt, stop
  │
  ├─ 2. deterministic normalisation → Draft with per-field {value, confidence, origin}
  │
  ├─ 3. route                        publish | llm | human   (+ reasons)
  │
  ├─ 4. LLM pass (only if routed)   → updated Draft → route again
  │
  ├─ 5. images                      download → POST /api/ingest/images → R2 URLs
  │
  └─ 6. write                       POST (new) or PATCH (changed), with publish flag + reasons
```

### 4.1 Change detection (PROPOSED)

At run start the client fetches `{ site_key, content_hash, status, human_reviewed }` for every garment of each source being run — a few hundred small rows, one request.

`content_hash` = sha256 over (`title`, `sku`, `article_code`, `description`, sorted `images`). Same hash → the listing hasn't changed → only `lastSeenAt` is touched, batched into one PATCH per run. This keeps a daily run cheap: most listings cost nothing beyond the fetch.

### 4.2 Deterministic normalisation (DECIDED in outline; details PROPOSED)

Ports the existing logic rather than reinventing it:

- **Article code parser** — the regex from `backfill-article-codes.js`, extended per site for SKU variants (The Library's `AF-0874-ORG-36` embeds the code plus a size). Full format `{TYPE}{GENDER}/{MODEL}[{PROC}][-{PROC}] {MATERIAL}[-{PROCESS}]/{COLOR}`, and the incomplete `{TYPE}{GENDER}/{MODEL}` form used by metal accessories.
- **Title formatter** — `formatTitle()` from `agent-review.js`: strip trailing `/COLOR`, expand `O.DYED` / `L. JKT` / `H. NECK`, Title Case.
- **Vocabulary mapping** — every field value checked against the `Property` collection for its `garmentKey`. Unknown → recorded, never coerced.
- **Color padding** — retailers write single-digit colors bare (`7`) where CCP pads them (`07`), so the bare form is padded on the way in. Only when the bare form is unknown and the padded one is known: **a leading zero denotes a different color, not a different spelling.** `10` (Black, Fabric) and `010` (Black, Leather) are separate entries, as are 19/019, 33/033, 35/035, 36/036 — and `3` (Grey, Reflective) is a genuine code, not an unpadded `03`. A blanket pad would mislabel hundreds of garments.
- **Category** — from the site's category hint, the article code's type letter, and title keywords; falls back to unknown.

Each field comes out as `FieldValue(value, confidence, origin)` where origin is one of `code`, `sku`, `title`, `hint`, `llm`. The webapp stores these so the review UI can show _why_ a field has the value it has.

### 4.3 Routing (DECIDED as rules; threshold PROPOSED)

Required for auto-publish (DECIDED, from the data): `category`, `type`, `gender`, `model`, `material`, and `color` — **except that `color` is not required when `category` is under `accessories.jewelry`.** `procedure` and `process` are optional.

This comes from the 313 human-verified Library garments: `procedure` is null on 56% of them and `process` on 31%, so requiring either would block auto-publish on more than half of real garments. `color` is null on 24, and every one of those is jewelry (24 of the 27 jewelry pieces) — silver rings and chains have no color code. Everything else has a color.

| Condition                                                                                              | Route       | Reason recorded                 |
| ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------- |
| Every required field parsed from a recognised article code, every value in vocabulary, title formatted | **publish** | —                               |
| Any value not in vocabulary                                                                            | **human**   | `unknown_vocab:<field>=<value>` |
| Category cannot be resolved to an existing one                                                         | **human**   | `unknown_category`              |
| Article code present but does not match the regex                                                      | **human**   | `code_unparseable:<raw>`        |
| A required field missing or only inferable from title/description                                      | **llm**     | `missing:<field>`               |
| Deterministic and LLM disagree on a field                                                              | **human**   | `disagreement:<field>`          |
| After LLM: confidence ≥ **0.90** and all values in vocabulary                                          | **publish** | —                               |
| After LLM: confidence < 0.90                                                                           | **human**   | `llm_low_confidence:<n>`        |

`human` reasons are additive and all recorded. Unknown-vocabulary alone does **not** trigger the LLM — the LLM cannot resolve a vocabulary decision, so spending a call on it buys nothing. If a listing has _both_ an unknown value and a missing field, the LLM still runs so the human starts from a better draft.

The threshold is a config value, not a constant. 0.90 is the starting point (DECIDED); the existing `--auto-apply-corrections` used 0.8.

The LLM is **skipped entirely for human-reviewed garments** — the server discards their field changes, so a call there buys nothing but latency and cost.

### 4.4 LLM pass (DECIDED)

Reached through **OpenRouter**'s OpenAI-compatible chat-completions endpoint, so the model is a config value (`INGEST_LLM_MODEL`) rather than a code change. Default `openai/gpt-5.6-luna`; any model that accepts images will do, since the `--images auto` retry attaches them. Text-only by default. Few-shot examples come from `AgentCorrection` documents (what humans actually changed), fetched once per run.

Images mode is a run option, `--images auto | always | never`:

- `auto` (default): text first; if the result is below threshold, one retry with the listing's first two images attached.
- `always`: images on every LLM call.
- `never`: text only, no retry.

Output is per-field values, an overall confidence, and a short `notes` string — the same shape the existing `review.js` prompt produces, so the prompt migrates rather than restarts.

### 4.5 Images (DECIDED)

Always copied to R2, never hotlinked. Python downloads each image and POSTs it to `/api/ingest/images`, which runs the same Sharp → WebP (quality 85) → R2 path the webapp uses for user uploads, keyed `<imageGroupId>/<uuid>.webp`. All 5,616 existing images already follow this pattern.

On update, new images are appended; existing images are never removed by the pipeline.

Each image stores the **source URL it was fetched from** alongside its R2 url, and both client and server deduplicate on that. This is load-bearing rather than cosmetic: every upload mints a fresh R2 UUID, so comparing final urls would never match, and a single edit to a listing would append its whole image set again. The run-start index returns each garment's known source urls so the pipeline skips downloading them at all.

Images that **predate the pipeline carry no source url**, so nothing can be matched against them — and on such a garment the pipeline appends nothing at all. This is not a nicety. The first full run re-copied all 2,863 images of the 471 migrated garments for exactly this reason, doubling every one of them, and accounted for most of a six-hour runtime. A garment that already has pictures loses less by missing a new one than by doubling the ones it has. Enforced in `updateIngestGarment` as well as the runner.

A garment's images are copied concurrently (`INGEST_IMAGE_CONCURRENCY`, default 6) while preserving order — the first image is the cover on the site, so the sequence is not cosmetic. Measured at ~2.8x over serial; it plateaus around 10 because the webapp's Sharp conversion, not the network, is the limit.

Skipped entirely on `--dry-run`.

## 5. Data model changes (webapp)

### `Garment` — new `ingest` subdocument (PROPOSED)

```js
ingest: {
  source:      String,   // "ccp-room"
  siteKey:     String,   // per-site stable id
  sourceUrl:   String,
  contentHash: String,
  runId:       String,   // run that created it
  lastRunId:   String,   // run that last touched it
  firstSeenAt: Date,
  lastSeenAt:  Date,
  humanReviewedAt: Date, // set when an admin publishes/edits it; gates re-scrape updates
  review: {
    required: Boolean,
    reasons:  [String],
    stage:    String,    // "deterministic" | "llm"
    fields:   Mixed,     // { material: { value, confidence, origin }, … }
    llm:      { model: String, confidence: Number, notes: String },
  },
}
```

Unique partial index on `{ "ingest.source": 1, "ingest.siteKey": 1 }`. The existing top-level `source: { type, label, url }` stays as the display field.

`status` keeps its three values. The service caller's `publish` flag maps to `published` or `pending`; the pipeline never writes `rejected`.

### `IngestRun` — new collection (DECIDED)

```js
{
  _id:        String,   // uuid, the runId
  startedAt, finishedAt: Date,
  durationMs: Number,
  status:     "running" | "completed" | "failed",
  trigger:    "cron" | "manual",
  options:    { sources: [String], dryRun: Boolean, images: String, limit: Number },
  sources: [{
    name, status, durationMs,
    listingsFound, unchanged, created, updated,
    published, needsReview, failed,
    error: String,      // set when the whole source threw — the "scraper broke" signal
  }],
  totals: { … same counters summed … },
  failures: [{ source, siteKey, url, message }], // per-listing, capped at 200 (`errors` is reserved by Mongoose)
}
```

### Migration of existing garments (DECIDED)

The two sources are treated differently, because their data is in different states:

The split is by **status**, not by source. Everything published has been through a person; everything pending has not.

- **Published — 469 garments (313 Library + 156 CCP-ROOM), all human-verified.** Kept. One backfill script sets `ingest.source` (from `source.label`: `The Library → the-library`, `CCP-ROOM → ccp-room`), `ingest.siteKey` from the URL path of `source.url`, `firstSeenAt = createdAt`, `lastSeenAt = updatedAt`, `contentHash = null`, and `humanReviewedAt = updatedAt`. On the first run they are recognised by site key and, being human-reviewed, only get `lastSeenAt` and a content hash written. Their fields are never touched.
- **Pending — 346 garments, all CCP-ROOM, scraped but never verified.** **Deleted** before the first run. The listings they came from are still on ccp-room, so the first run re-discovers them as new and puts them through the full pipeline — routing decides which publish immediately and which wait for review. Cleaner than reconciling half-finished scraper output with the new normalisation.

Consequences worth knowing:

- Nothing comes off the site. The first ccp-room run recognises the 156 kept garments by site key and creates the rest fresh.
- The 346 deleted garments' R2 images become orphans, since the re-ingest uploads fresh copies. Harmless; a one-off cleanup can remove keys not referenced by any garment later.
- The same script does both, with `--dry-run` reporting counts first: it must find exactly 469 to backfill and 346 to delete, and refuses to run if the numbers don't match, since those counts are known today.

There are no user-submitted garments to consider: all 815 documents are attributed to the single import user.

## 6. Re-scrape and change over time (DECIDED in outline; policy PROPOSED)

- **Unchanged listing** → `lastSeenAt` bumped, nothing else.
- **Changed listing, not yet human-reviewed** → re-normalised and re-routed exactly like a new one; fields and images PATCHed; may flip `pending → published`.
- **Changed listing, human-reviewed** → the pipeline does not touch classification fields or title. Only `lastSeenAt`, `contentHash`, and appended images are written. The human's edits win.
- **Disappeared listing** → nothing happens; `lastSeenAt` stops advancing. The garment stays on the site. The admin can filter on "not seen since".
- **Published garments are never demoted by the pipeline.** Only the run-level unpublish action (below) or an admin does that.

No sighting history. One garment, one current state. (DECIDED)

## 7. Webapp API — `/api/ingest/*` (PROPOSED)

### Auth

`Authorization: Bearer <INGEST_API_TOKEN>` — a shared secret in the webapp's env, compared in constant time. Every route under `/api/ingest/` requires it and nothing else accepts it. It is deliberately not Clerk: there is exactly one caller, it is a script, and Clerk's machine-token features would add setup for no gain yet. It can be swapped for Clerk M2M later without changing the Python side beyond one header.

The server sets `uploadedByUserId` to the system user from env — it is **never** read from the request body on these routes.

The existing `POST /api/garment` reads `uploadedByUserId` from the request body, so any signed-in user can attribute a garment to anyone. **Fixed as part of Phase 0** (DECIDED): the route sets it from the Clerk session and ignores the body field.

### Routes

| Method  | Path                           | Purpose                                                                                   |
| ------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `GET`   | `/api/ingest/context`          | Properties, categories, recent `AgentCorrection`s, system user id — one call at run start |
| `GET`   | `/api/ingest/garments?source=` | `[{ siteKey, contentHash, status, humanReviewedAt, _id }]` for dedup / change detection   |
| `POST`  | `/api/ingest/runs`             | Create a run → `runId`                                                                    |
| `PATCH` | `/api/ingest/runs/:id`         | Per-source progress and final totals                                                      |
| `POST`  | `/api/ingest/garments`         | Create. Body: fields + `ingest` metadata + `publish: bool`                                |
| `PATCH` | `/api/ingest/garments/:id`     | Update on re-scrape, honouring the human-reviewed policy server-side                      |
| `PATCH` | `/api/ingest/garments/touch`   | Batch `lastSeenAt` bump for unchanged listings                                            |
| `POST`  | `/api/ingest/images`           | Multipart image → WebP → R2 → URL                                                         |

Plus one **admin** (Clerk, not service token) route:

| `POST` | `/api/admin/ingest/runs/:id/unpublish` | Every garment with `ingest.runId = :id` and `status = published` → `pending` |

The update policy in §6 is enforced in the PATCH handler, not trusted from the client, so a bug in Python cannot overwrite a human's edits.

## 8. Admin (DECIDED in outline; PROPOSED in detail)

- **One queue at `/admin`.** Pending garments from every origin — user submissions and pipeline. Pipeline-originated cards additionally show the review reasons, a per-field confidence/origin badge, the source link, and the LLM's notes. Editing and publishing works as today.
- **Publishing from the queue records an `AgentCorrection`** — `before` is the pipeline's field values, `after` is what the human saved. That is the few-shot feedback loop, kept. (DECIDED)
- **`/admin/agent` is retired.** The pipeline now classifies _before_ the garment lands, so there is no separate "proposal on an existing garment" step. The `AgentProposal` collection stays until the 79 pending proposals are cleared, then goes.
- **New `/admin/runs`.** Run history with the counters above, per-source status with errors surfaced, and a per-run **Unpublish** button with a confirmation showing the count. This is the kill switch.
- `/admin/properties` unchanged — it is where humans add vocabulary.

## 9. Python project (PROPOSED)

```
wikipoell-ingest/
├── pyproject.toml            uv-managed; ruff for lint/format
├── DESIGN.md                 this file
├── README.md
├── ingest/
│   ├── __main__.py           python -m ingest run [source ...] [--dry-run] [--images auto|always|never] [--limit N] [--no-llm]
│   ├── config.py             env, thresholds, per-source delays
│   ├── models.py             RawListing, FieldValue, Draft, RouteDecision (pydantic)
│   ├── client.py             WikipoellClient — the only thing that knows the API
│   ├── runner.py             per-source orchestration, run bookkeeping
│   ├── normalize/
│   │   ├── article_code.py
│   │   ├── title.py
│   │   ├── vocabulary.py
│   │   └── category.py
│   ├── route.py
│   ├── llm.py
│   ├── images.py
│   └── sources/
│       ├── base.py           Source protocol, HTTP helper with delay + retry
│       ├── shopify.py        ShopifySource base (the_library, closetcase)
│       ├── ccp_room.py
│       ├── the_library.py
│       └── …one file per remaining site
└── legacy/                   today's ccp-room/, the-library/, agent-review/, data/ — kept, not maintained
```

Dependencies: `httpx`, `selectolax` (fast HTML parsing), `pydantic`. No Selenium, no Pillow — image conversion stays in the webapp, and the LLM is reached over plain HTTP rather than a vendor SDK.

`--dry-run` executes the full pipeline including routing and (unless `--no-llm`) the LLM, prints per-listing decisions, and writes nothing — no run record, no images, no garments.

Sources are positional (DECIDED): `python -m ingest run ccp-room the-library` runs those two; `python -m ingest run` with no names runs every registered source. Unknown names fail fast before anything is fetched.

`--limit N` caps listings per source. First runs of a new module should use it.

## 10. Runs and operations (DECIDED)

- Every run writes an `IngestRun`; the run id goes on every garment it creates or updates.
- A source whose module throws is marked failed with the error and the run continues. A source that returns **zero listings** when it previously returned some is also flagged — that is the "HTML changed, scraper silently broken" case, and it is the one that would otherwise go unnoticed.
- Run output goes to stdout in a form a scheduler log can keep, and to the `IngestRun` document for the admin page.
- No scraper test suite. If a module breaks, the run reports it.
- Scheduler is external and unspecified — cron, GitHub Actions, anything. Secrets live in a `.env` file (DECIDED): `wikipoell-ingest/.env`, this project's own, holding `WIKIPOELL_API_URL`, `INGEST_API_TOKEN`, and `OPENROUTER_API_KEY`, with shell-exported values taking precedence. It is deliberately separate from the webapp's `.env`, which needs `INGEST_API_TOKEN` (matching) and `INGEST_SYSTEM_USER_ID`.

## 11. Build order (PROPOSED)

| Phase | Scope                                                                                | Done when                                                                 |
| ----- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **0** | Webapp: `Garment.ingest`, `IngestRun`, `/api/ingest/*`, system user, backfill script | Backfill run; `GET /api/ingest/garments?source=ccp-room` returns 502 rows |
| **1** | Python skeleton, client, normalisation ports, routing, `ccp_room` module             | `--dry-run` over ccp-room prints sensible routes for all ~500 listings    |
| **2** | `ShopifySource` + `the_library`, LLM pass, image upload                              | Both legacy scrapers fully replaced; a real run creates/updates correctly |
| **3** | Admin: unified queue with reasons, `/admin/runs`, unpublish                          | A bad run can be reverted from the UI                                     |
| **4** | Remaining seven sources, one PR each, each first run with `--limit`                  | All nine live                                                             |
| **5** | Retire `/admin/agent`, move legacy code under `legacy/`                              | —                                                                         |

Phase 0 and 1 can proceed in parallel; 1 can be built against a stubbed client.

## 12. Decisions log

Resolved in discussion, recorded here so the reasoning survives:

| #   | Question                                  | Decision                                                                                                                                                |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Existing garments on first run            | All 469 published garments (both sources) kept and backfilled as human-reviewed; the 346 pending CCP-ROOM garments deleted and re-discovered fresh (§5) |
| 2   | LLM threshold                             | 0.90 (§4.3)                                                                                                                                             |
| 3   | Required fields for auto-publish          | `category, type, gender, model, material`, plus `color` except for jewelry; `procedure`/`process` optional — from the Library data (§4.3)               |
| 4   | Update policy for human-reviewed garments | As proposed in §6: `lastSeenAt` and appended images only, fields untouched. Not objected to; treated as accepted                                        |
| 5   | Python tooling                            | `uv` + `ruff` + `selectolax` (§9)                                                                                                                       |
| 6   | `uploadedByUserId` from request body      | Fixed in Phase 0 (§7)                                                                                                                                   |
| 7   | Secrets                                   | `.env` at the repo root (§10)                                                                                                                           |
| —   | Source selection                          | Positional names on the command line, all sources when omitted (§9)                                                                                     |

Nothing is open.
