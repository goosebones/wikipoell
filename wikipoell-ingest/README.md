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
cp .env.example .env                 # then fill it in (see Environment)
```

The pipeline writes straight to the archive's MongoDB database and the garment
photo bucket; nothing else needs to be running. `INGEST_DB` picks the
database: `pinch-seam` for development, `spur-biter` for production, and
`run --db NAME` overrides it for one run.

Then:

```bash
.venv/bin/python -m ingest sources                      # what's registered
.venv/bin/python -m ingest inspect ccp-room --limit 5   # what a source reads
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
| `--force`   | reprocess listings the site has not changed. Sources must be named                     |
| `--quiet`   | per-source totals only, no per-listing lines                                           |
| `--images`  | `auto` (default) / `always` / `never` — when the LLM sees images                       |
| `--no-llm`  | skip the LLM pass                                                                      |
| `--db NAME` | write to this database instead of `INGEST_DB`                                          |

### Applying a fix to garments already stored

A normal run skips any listing whose content hash is unchanged, so fixing a
parser or adding a property value does not by itself reach garments already in
the database — the sites did not change, our reading of them did. `--force`
skips that check:

```bash
.venv/bin/python -m ingest run closetcase --force --dry-run   # see what moves
.venv/bin/python -m ingest run closetcase --force             # apply it
```

Two things it deliberately does not do:

- **It will not run without named sources.** Forcing all nine is hours of
  scraping and roughly one LLM call per garment, which is rarely the intent.
- **It still skips human-reviewed garments.** The store discards field changes
  on those, so forcing them would cost an LLM call and a write to change
  nothing. They stay in the `unchanged` count.

`--force` is for when the _parsing_ changed. For a vocabulary addition, a
`recheck` command that re-tests pending garments' blockers without scraping is
planned (PLAN.md).

## How it works

```
RawListing → change detect → normalise → route → [LLM] → images → write
                  │                        │
            content hash            publish | llm | human
```

A **source module** does one thing: turn a site into `RawListing`s, each with
its identity, images, attributes and details (see "Adding a source"). It does
no classification at all, which is what keeps modules small and replaceable
when a site changes its markup.

Everything after that is shared:

- `normalize/article_code.py` — parses `LM/2699-IN BIMS-PTC/19` into fields
- `normalize/title.py` — house-style titles; strips the `/19/st` metadata
  suffixes ccp-room appends
- `normalize/category.py` — keyword rules, scoped by the site's own section
- `normalize/vocabulary.py` — the `Property` collection as a lookup; a value
  outside it is recorded, never coerced
- `route.py` — the publish / llm / human decision and its reasons

`store.py` is the only module that touches MongoDB and R2. The database's
validators (the webapp's `scripts/setup-db.mjs`) enforce the garment shape;
the store enforces the two rules that matter most: human-reviewed garments
keep their fields, and published garments are never demoted. Vocabulary
codes are translated to node ids on the way in (`normalize/vocabulary.py`),
and a known model supplies the category. At the end of a real run the store
asks the site to refresh its cache (`POST /api/revalidate`).

## Adding a source

Every source answers the same four questions, one method each, on the base
class in `ingest/sources/base.py`:

| Question | Method | Returns |
| --- | --- | --- |
| **Navigation**: how to reach every garment | `items()` | one item per garment: a JSON product, a parsed detail page, a catalog node |
| **Images**: where its photos are | `images(item)` | absolute URLs in display order; the first is the cover |
| **Attributes**: what the site states about its classification | `attributes(item)` | `Attributes`: the article code above all, plus gender, category and color where given separately |
| **Details**: anything else useful for classifying it | `details(item)` | label → text under `Detail` labels: vendor category, composition, color and material names, feature lines, sizes |

Plus identity and text: `site_key(item)`, `url(item)`, `title(item)` and
`description(item)`, which the content hash is built from. The base turns
these into `RawListing`s, drops duplicate images and empty details, and
records unreadable products as run failures instead of ending the source.

Details are for a person or the LLM, never classified. Take what is about
*this* garment: a composition line, the shop's own category, a color name, a
descriptive name where the title is a code, bullet-like feature lines
("Oxide / rust drops"). Leave out shop boilerplate: shipping, store hours,
contact lines, other products.

Most shops are one of three kinds, each with a base that implements
navigation, images and the obvious details:

| Base | For | Navigation |
| --- | --- | --- |
| `ShopifySource` | Shopify | `/products.json`, filtered by vendor |
| `WooCommerceSource` | WooCommerce | the Store API; you decide which products are CCP |
| `HtmlCatalogSource` | anything server-rendered | brand pages (paginated), each product's detail page |

`ingest/sources/extract.py` has the helpers for reading pages: prose to text,
labeled rows and `<dl>`s to pairs, schema.org product data, meta tags.

Steps:

1. Look at the site: a listing page and two or three product pages. Note
   where the code, photos and labeled fields are, and whether the page has
   schema.org data (`json_ld_product`).
2. Create `ingest/sources/<name>.py` on the fitting base. Set `name` and
   `label`, and write the hooks the base doesn't cover. Open the file with a
   docstring answering the four questions for this site, as the existing
   modules do.
3. Pick a **site key**: a stable per-site id, unique per listing, that survives
   re-scrapes. The bases default to the URL path.
4. Register it in `ingest/sources/__init__.py`.
5. Read what it extracts, with nothing classified or written:
   `python -m ingest inspect <name> --limit 10` (`--json` for the full record).
   Then `run <name> --dry-run --limit 20`, then widen.

Use `self.get_text(url)` / `self.get_json(url)` rather than httpx directly:
they carry the rate limiting, retries and Retry-After handling.

**Changing an existing source:** the content hash covers the title, SKU,
article code, description and image URLs. Changing how any of those is read
makes every stored listing of that source look changed, and new image URLs
make garments append their photos again. Details are not hashed and can change
freely. If image URLs must change, run
`python -m ingest replace-images <name>` before the next normal run: it swaps
stored garments' photos for the new ones and leaves their fields alone.

## Sources

Where a source publishes article codes, most listings classify
deterministically; where it does not, they reach the review queue by design
rather than by guesswork.

| Source | Platform | Attributes from | Details |
| --- | --- | --- | --- |
| `ccp-room` | custom, one page | `data-article`, `data-color`, the section | color name, composition |
| `the-library` | Shopify | MODEL / MATERIAL / COLOUR labels, gender and category tags | material and colour as written, product type, sizes, tags |
| `closetcase` | Shopify | the **title is the code**; `CATEGORY_*` tag | color tag, feature lines, product type, tags |
| `thirdshed` | WooCommerce | the name is the code; brand never appears | descriptive name, feature lines |
| `lazzari` | PrestaShop | the detail page's `mpn` reference | data sheet: color, composition |
| `darklands` | custom | the code paragraph; gender from the entry page | schema.org category, composition, sizes |
| `ink` | custom | the `h1` is the code; gender from the entry page | descriptive name, collection, material, sizes |
| `shelter2` | JP hosted cart | 品番 (article number) joined with the color option's code | English name, 素材 (material), colors, sizes |

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

### Titles a site does not have

Most sources carry both a code and a descriptive name. `ink` carries only the
code, in its `h1` — there is no sentence to scrape and none to be inferred.
A source can say so by setting `title_is_final` on the listing it returns:
the title is then published exactly as written, skipping both `format_title()`
and the `title_unformatted` flag that would otherwise send it to the LLM to
have a name invented for it. Only `ink` sets it today.

## Images

Every image is copied to R2, never hotlinked, and deduplicated on its
**source URL**. Copies within a garment run concurrently
(`INGEST_IMAGE_CONCURRENCY`, default 6) while preserving order.

## Environment

Reads this project's own `.env`: copy `.env.example` and fill it in.
Shell-exported values take precedence. It does not read the webapp's env
files.

| | |
| --- | --- |
| `MONGODB_URL` | the archive's cluster (the webapp's `MONGODB_URL`) |
| `INGEST_DB` | `pinch-seam` (development) or `spur-biter` (production); `--db` overrides |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | a token that can write to the garment bucket |
| `R2_BUCKET_NAME`, `R2_S3_API_URL`, `R2_PUBLIC_URL` | the garment bucket, its S3 endpoint, and its public address |
| `SITE_URL`, `REVALIDATE_TOKEN` | the site to refresh after a run, and the token its `/api/revalidate` expects (the same value as the webapp's `REVALIDATE_TOKEN`). Optional |
| `OPENROUTER_API_KEY` | for the LLM pass; not needed with `--no-llm` |
| `INGEST_LLM_MODEL` | OpenRouter model slug, default `openai/gpt-5.6-luna`. Must accept images; the `--images auto` retry attaches them |
| `INGEST_IMAGE_CONCURRENCY` | images copied in parallel within one garment, default 6 |
| `INGEST_REQUEST_DELAY` | seconds between requests to one site, default 1.5 |
| `INGEST_LLM_THRESHOLD` | auto-publish confidence floor, default 0.90 |

New garments are attributed to the user every existing pipeline garment
already has.

Requests go out with httpx's default user agent; no browser string is spoofed.
All eight sources were verified to respond normally to it.

The webapp's eslint/prettier ignore this folder wholesale.
