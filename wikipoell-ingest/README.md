# wikipoell-ingest

Scrapers, importers, and data-quality tooling that feed the Wikipoell archive.

Everything here is **run by hand** — none of it is on the webapp's request path. It lives in the same repo as the webapp because it shares the same MongoDB, the same R2 bucket, and the same `.env` (at the repo root, one level up).

Two source pipelines exist, one per site, plus a Claude-backed review pass that cleans up whatever they produce.

## ccp-room.com — JavaScript

```bash
npm run ccp-room:scrape              # catalog -> data/ccp-room-garments.json
npm run ccp-room:import -- --dry-run # that JSON -> R2 + MongoDB (pending)
npm run ccp-room:backfill -- --dry-run
```

| Step     | File                                 | Notes                                                                                                                                                                                                                                                      |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scrape   | `ccp-room/scrape.js`                 | Writes `data/ccp-room-garments.json`. Image URLs stay pointed at ccp-room.com at this stage.                                                                                                                                                               |
| Import   | `ccp-room/import.js`                 | Downloads each image, converts to WebP via Sharp (quality 85, matching the webapp's upload pipeline), uploads to R2 under `<imageGroupId>/<uuid>.webp`, inserts a `Garment` with `status: "pending"`. Failures land in `data/import-ccp-room-errors.json`. |
| Backfill | `ccp-room/backfill-article-codes.js` | Re-parses article codes for documents where `type`/`material` came out null. Matches on `source.url`.                                                                                                                                                      |

Both `import` and `backfill` take `--dry-run`. Use it first — `import` writes to R2 and MongoDB, and neither is easy to undo.

## thelibrary1994.com — Python notebooks

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/jupyter lab   # or point your editor at .venv
```

Run in order; each reads what the previous one wrote:

1. `the-library/1-scrape.ipynb` — Selenium scrape → `the-library/products/`
2. `the-library/2-process-products.ipynb` — normalises into `the-library/processed_products/`
3. `the-library/3-upload.ipynb` — uploads to Wikipoell

The notebooks resolve `products/` and `processed_products/` **relative to their own directory**, so run them from `the-library/` and keep those folders as siblings.

`data/library.json` is a Shopify product dump from the same site. Nothing currently reads it — it predates the notebooks and is kept as reference.

## Agent review

```bash
npm run agent-review -- --deterministic    # no API cost, rules only
npm run agent-review -- --limit=25
npm run agent-review -- --auto-apply-corrections
```

`agent-review/review.js` reads pending garments that have no proposal yet, sends each to Claude using prior `AgentCorrection` documents as few-shot examples, and writes an `AgentProposal`. An admin then reviews at `/admin/agent` in the webapp; accepting writes back an `AgentCorrection`, which sharpens the next run.

So this script and the webapp are two halves of one loop even though they live in different folders — **`/admin/agent` renders whatever this writes.** Changing the proposal shape here means changing `components/admin/agent-proposal/` there.

`--deterministic` skips Claude entirely and applies rule-based fixes only. Prefer it while working on the pipeline itself.

`--auto-apply-corrections` writes straight to MongoDB for any proposal at confidence ≥ 0.8, with no human review. It is the one flag here that changes published data without a person in the loop.

## Data

| Path                                           | Tracked | What                                                                                                                  |
| ---------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `data/ccp-room-garments.json`                  | yes     | ccp-room scrape output, the input to `import.js`                                                                      |
| `data/garments_backup_20260506_072451.json`    | yes     | JSONL garment backup from 2026-05-06 — one JSON object per line, so it is **not** parseable as a single JSON document |
| `data/library.json`                            | no      | Shopify dump, reference only                                                                                          |
| `the-library/products/`, `processed_products/` | no      | 313 files each, regenerable from the notebooks                                                                        |

## Tooling

```bash
npm run lint      # eslint .
npm run lint:fix
npm run format    # prettier --write .
npm run format:check
```

This project has its own `eslint.config.mjs` and `.prettierignore`, and the webapp's tooling ignores this folder wholesale — the rules here answer to plain Node, not React/Next. Run these **from this directory**; the repo root's `npm run lint` does not reach in here.

There is no `node_modules` here on purpose: npm puts the repo root's `node_modules/.bin` on `PATH`, so `eslint` and `prettier` resolve from the webapp's install with nothing extra to install. Prettier's own settings are inherited from the root `.prettierrc`.

Scripts are CommonJS except `agent-review/review.js`, which is ESM; the ESLint config encodes that per-file, so `import` in a `ccp-room/` script is an error.

## Environment

Reads the webapp's `.env` at the repo root via `process.loadEnvFile()`; variables already exported in your shell take precedence. Needs `MONGODB_URL`, the `R2_*` group (for `import.js`), and `ANTHROPIC_API_KEY` (for `agent-review`, unless `--deterministic`).
