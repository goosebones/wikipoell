# wikipoell-ingest

Scraping and ingest for the Wikipoell archive. The pipeline discovers Carol
Christian Poell garments on retailer sites, standardises them against the
archive's vocabulary, and publishes them — routing to a human only when it has
to.

**`DESIGN.md` is the specification.** Read it before changing pipeline
behaviour; this file is just how to run things.

## Quick start

One-time setup, from this directory:

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"    # deps + ruff, editable
cp .env.example .env                 # then fill in INGEST_API_TOKEN
```

The pipeline talks to the webapp's API, so **the webapp has to be running**.
`WIKIPOELL_API_URL` in `.env` must point at it:

| Webapp command  | Serves                                              | Set `WIKIPOELL_API_URL` to |
| --------------- | --------------------------------------------------- | -------------------------- |
| `npm run start` | `http://localhost:3000`                             | `http://localhost:3000`    |
| `npm run dev`   | `https://localhost` (port 443, locally-issued cert) | needs `INGEST_CA_BUNDLE`   |

`npm run start` needs a production build first (`npm run build`). Use that one.

Then:

```bash
.venv/bin/python -m ingest sources                      # what's registered
.venv/bin/python -m ingest run --dry-run                # everything, writes nothing
.venv/bin/python -m ingest run ccp-room --dry-run       # one source
.venv/bin/python -m ingest run ccp-room --limit 20      # live, capped
```

`pip install -e` puts the package on the path, so `python -m ingest` works from
any directory once the venv is active. Activate it with
`source .venv/bin/activate` if you would rather type `python -m ingest`.

Sources are **positional**. With none given, every registered source runs.
An unknown name fails before any network request is made.

| Flag        |                                                                                        |
| ----------- | -------------------------------------------------------------------------------------- |
| `--dry-run` | scrape, normalise and route, but write nothing — no garments, no images, no run record |
| `--limit N` | stop after N listings per source. Use it the first time a new module runs              |
| `--quiet`   | per-source totals only, no per-listing lines                                           |
| `--images`  | `auto` (default) / `always` / `never` — when the LLM sees images (Phase 2)             |
| `--no-llm`  | skip the LLM pass (Phase 2)                                                            |

## How it works

```
RawListing → change detect → normalise → route → [LLM] → images → write
                  │                        │
            content hash            publish | llm | human
```

A **source module** does one thing: turn a site into `RawListing`s. It does no
classification at all, which is what keeps modules small and replaceable when a
site changes its markup.

Everything after that is shared:

- `normalize/article_code.py` — parses `LM/2699-IN BIMS-PTC/19` into fields
- `normalize/title.py` — house-style titles; strips the `/19/st` metadata
  suffixes ccp-room appends
- `normalize/category.py` — keyword rules, scoped by the site's own section
- `normalize/vocabulary.py` — the `Property` collection as a lookup; a value
  outside it is recorded, never coerced
- `route.py` — the publish / llm / human decision and its reasons

Nothing here touches MongoDB. Every read and write goes through the webapp's
`/api/ingest/*`, so Mongoose stays the single definition of a garment.

## Adding a source

1. Subclass `Source` in `ingest/sources/<name>.py`, set `name` and `label`,
   implement `listings()`.
2. Pick a **site key** — a stable per-site id. It must be unique per listing
   and survive re-scrapes; see `DESIGN.md` §2 for the two existing choices.
3. Register it in `ingest/sources/__init__.py`.
4. `--dry-run --limit 20`, read the output, then widen.

Use `self.get_text(url)` / `self.get_json(url)` rather than httpx directly —
they carry the rate limiting, retries and Retry-After handling.

## Sources

All nine are live. Where a source publishes article codes, most listings
classify deterministically; where it does not, they reach the review queue by
design rather than by guesswork.

| Source        | Platform         | How it reads                                                                |
| ------------- | ---------------- | --------------------------------------------------------------------------- |
| `ccp-room`    | custom, one page | 579 listings from a single request — the whole catalog is in `data-*` attrs |
| `the-library` | Shopify          | `/products.json`; code is split across MODEL/MATERIAL/COLOUR labels         |
| `closetcase`  | Shopify          | `/products.json`; the product **title is the article code**                 |
| `thirdshed`   | WooCommerce      | Store API; names are article codes, brand never appears                     |
| `lazzari`     | PrestaShop       | Listing pages only — the card's `img alt` carries the full code             |
| `darklands`   | custom           | Detail pages; gender from the men's/women's entry page                      |
| `ink`         | custom           | Detail pages; `h1` is the code, gender from the entry page                  |
| `shelter2`    | JP hosted cart   | Detail pages; Japanese titles, but the codes are not                        |
| `bilzerian`   | BigCommerce      | Detail pages; **publishes no article code**, so everything is reviewed      |

Four of them need one request per product, because the content hash is built
from detail-page data and there is nothing to compare without fetching it.
`ink` is the slow one (~500 products per gender); the rest are small.

`lazzari`, `closetcase`, `thirdshed`, `the-library` and `ccp-room` need only
a handful of requests each.

## Article codes

Retailers space codes out in ways CCP does not, so `clean_article_code()`
normalises before parsing — purely whitespace-level, no token is
reinterpreted. That lifted parse rates measurably: closetcase 65→110 of 141,
thirdshed 306→317 of 335, the-library 144→149, with ccp-room unchanged at 566
of 579 because it writes them canonically.

`ink` needs one extra step of its own: its " / " separates the model group
from the material group, where every other site uses it between material and
colour, so the module turns it into a space before handing it over.

## Images

Every image is copied to R2, never hotlinked, and deduplicated on its
**source URL**. Copies within a garment run concurrently
(`INGEST_IMAGE_CONCURRENCY`, default 6) while preserving order.

## Environment

Reads this project's own `.env` — copy `.env.example` and fill it in.
Shell-exported values take precedence. It does **not** read the webapp's
`.env` at the repo root; the two are independent.

|                            |                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WIKIPOELL_API_URL`        | default `http://localhost:3000`                                                                                                                                                                       |
| `INGEST_API_TOKEN`         | service token for `/api/ingest/*`                                                                                                                                                                     |
| `OPENROUTER_API_KEY`       | for the LLM pass; not needed with `--no-llm`                                                                                                                                                          |
| `INGEST_LLM_MODEL`         | OpenRouter model slug, default `openai/gpt-5.6-luna`. Must accept images — the `--images auto` retry attaches them                                                                                    |
| `INGEST_CA_BUNDLE`         | CA for the API's certificate when it is HTTPS with a local cert. Supports `~` and project-relative paths. Applies to the API only — scraped sites use the normal trust store                          |
| `INGEST_IMAGE_CONCURRENCY` | images copied in parallel within one garment, default 6. Measured here: serial 1.19 s/image, 6 → 0.43, 10 → 0.36, 16 → no further gain — the webapp's WebP conversion is the ceiling, not the network |
| `INGEST_REQUEST_DELAY`     | seconds between requests to one site, default 1.5                                                                                                                                                     |
| `INGEST_LLM_THRESHOLD`     | auto-publish confidence floor, default 0.90                                                                                                                                                           |

`INGEST_API_TOKEN` must match the value in the **webapp's** `.env`, which
also needs `INGEST_SYSTEM_USER_ID` — the Clerk user pipeline garments are
attributed to.

Requests go out with httpx's default user agent; no browser string is spoofed.
All nine sources were verified to respond normally to it.

## Tooling

```bash
.venv/bin/ruff check ingest/     # lint
.venv/bin/ruff format ingest/    # format
```

The webapp's eslint/prettier ignore this folder wholesale.

## legacy/

The scrapers this replaces: the ccp-room JS scripts, the Library notebooks, and
`agent-review/review.js`. Kept for reference, not maintained. Their logic has
been ported into `ingest/normalize/`.
