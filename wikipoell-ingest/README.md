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

## Current status

|                   |                                                                          |
| ----------------- | ------------------------------------------------------------------------ |
| `ccp-room`        | ✅ 579 listings from one page request                                    |
| `the-library`     | Phase 2 — Shopify `/products.json`                                       |
| LLM pass          | Phase 2 — until then, anything routed to the LLM goes to a human instead |
| Image upload      | Phase 2                                                                  |
| The other 7 sites | Phase 4                                                                  |

## Environment

Reads this project's own `.env` — copy `.env.example` and fill it in.
Shell-exported values take precedence. It does **not** read the webapp's
`.env` at the repo root; the two are independent.

|                        |                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WIKIPOELL_API_URL`    | default `http://localhost:3000`                                                                                                                                              |
| `INGEST_API_TOKEN`     | service token for `/api/ingest/*`                                                                                                                                            |
| `ANTHROPIC_API_KEY`    | Phase 2                                                                                                                                                                      |
| `INGEST_CA_BUNDLE`     | CA for the API's certificate when it is HTTPS with a local cert. Supports `~` and project-relative paths. Applies to the API only — scraped sites use the normal trust store |
| `INGEST_REQUEST_DELAY` | seconds between requests to one site, default 1.5                                                                                                                            |
| `INGEST_LLM_THRESHOLD` | auto-publish confidence floor, default 0.90                                                                                                                                  |

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
