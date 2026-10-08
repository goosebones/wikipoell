# Garment schema — attribute refactor

Status: **agreed in discussion, not yet implemented.** The ingest pipeline is out of scope for this pass and will be revisited separately.

## Goals

- Make the **model** a first-class entity: a curated list with a name and a suggested category, and the basis of a garment's title.
- **Derive the title** from the model instead of storing free text, with an explicit override.
- Make **color** and **material** hierarchical, so a query for a parent returns everything beneath it.
- Introduce **extras**: optional, hierarchical attributes for motifs such as rubber drip, prosthetic, stained, spur biter, tank sole, self edge, reflective, gloved.
- Split the generic `Property` collection into one collection per field.

Type, gender, procedure and process keep working as they do today. Type stays its own flat attribute and is not part of the category tree.

## Vocabulary collections

The `Property` collection is replaced by one collection per field. All of them share a base shape, so the generic code that reads vocabulary (filters, admin manager, unknown-value detection, search suggestions) stays generic. A single loader returns `{ type: [...], gender: [...], color: [...], ... }`.

| Collection   | Shape                                       | Hierarchy               |
| ------------ | ------------------------------------------- | ----------------------- |
| `models`     | `{ _id: "2600", label, suggestedCategory }` | flat                    |
| `colors`     | `{ _id, label, code, parent }`              | any depth, path ids     |
| `materials`  | `{ _id, label, code, parent }`              | any depth, path ids     |
| `extras`     | `{ _id, label, parent }`                    | any depth, path ids     |
| `types`      | `{ _id: slug, label, code }`                | flat                    |
| `genders`    | `{ _id: slug, label, code }`                | flat                    |
| `procedures` | `{ _id: slug, label, code }`                | flat                    |
| `processes`  | `{ _id: slug, label, code }`                | flat                    |
| `categories` | unchanged                                   | any depth, path ids     |

### Hierarchy conventions

These follow the existing `categories` collection.

- `_id` is the dot-delimited path of slugs from the root: `black.010.b`, `leather.kangaroo.rooms`, `prosthetic.elbow`.
- `parent` is the `_id` of the node above it, or `null` for a root.
- Any node can be assigned to a garment, including a root. `color: "black"` means "black, exact code unknown".
- **Querying a subtree** is an anchored prefix match that stops at a segment boundary: `^black\.010(\.|$)`, never a bare `^black.010`. Otherwise `black.01` would match `black.010`. Ids that come from user input are still escaped before they go into a regex.
- **Moving a node changes its `_id`** and that of everything beneath it, so every garment that references it must be rewritten in the same operation. That is acceptable at the archive's size.

### Slugs

Every segment of an `_id` (and the whole `_id` of a flat collection) is a lowercase slug. The CCP code as CCP writes it lives only in `code`, which is what the UI shows and the article code prints. Slugs need no escaping in URLs, and no two nodes can differ only in case.

- A slug is **suggested from the code** when a node is created, can be edited at that point, and is **never recomputed** afterwards.
- The default suggestion is: lowercase; `*` → `star`, with a count when repeated; any other run of non-alphanumeric characters → `-`.

  | Code      | Slug        |
  | --------- | ----------- |
  | `19*`     | `19-star`   |
  | `19**`    | `19-star2`  |
  | `X=NIT`   | `x-nit`     |
  | `ON EDGE` | `on-edge`   |
  | `14 ORG`  | `14-org`    |
  | `010B`    | `010b`      |

- Symbols are spelled out rather than stripped, because stripping merges different codes (`19` is grey and `19**` is rust).
- Slugs are unique within a collection (enforced by an index on `_id`), so a collision is caught when the node is created.
- Category ids keep their existing camelCase. They are names rather than codes, so the difference is accepted.

### `colors`

```js
{ _id: "black",       label: "Black",           code: null,   parent: null }
{ _id: "black.010",   label: "Black (Leather)", code: "010",  parent: "black" }
{ _id: "black.010.b", label: "…",               code: "010B", parent: "black.010" }
{ _id: "black.10",    label: "Black (Fabric)",  code: "10",   parent: "black" }
```

- Roots are written-out color families: `black`, `grey`, `green`, `blue`, `brown`, …
- Below a family are CCP color codes, and below a code are its variants (`010` → `010B`).
- `code` is what appears in the article code. It is stored explicitly rather than rebuilt from the path, because some codes do not decompose (`19**`, `1919`).
- A leading zero is a different color, not a different spelling: `10` and `010` are siblings, never aliases.
- Suffixed codes that change the color are their own nodes, filed under the family they actually belong to. `19**` is Rust (Slow Veg Tanned), not a kind of grey `19`.
- `code` is unique where present. Family nodes have no code.

### `materials`

Same shape and rules as `colors`. Intermediate nodes group materials, and the leaves carry CCP material codes.

```js
{ _id: "leather",                 label: "Leather",  code: null,    parent: null }
{ _id: "leather.kangaroo",        label: "Kangaroo", code: null,    parent: "leather" }
{ _id: "leather.kangaroo.rooms",  label: "…",        code: "ROOMS", parent: "leather.kangaroo" }
{ _id: "leather.horse.cors",      label: "…",        code: "CORS",  parent: "leather.horse" }
```

A garment has exactly one material.

### `extras`

```js
{ _id: "rubber-drip",      label: "Rubber Drip", parent: null }
{ _id: "rubber-drip.black", label: "Black",       parent: "rubber-drip" }
{ _id: "prosthetic",       label: "Prosthetic",  parent: null }
{ _id: "prosthetic.elbow", label: "Elbow",       parent: "prosthetic" }
```

- Extras have no parameters. A color on an extra is a child node named after the color (`rubber-drip.black`), not a reference to a color code.
- Extras never appear in the article code, so they have no `code`.
- Absence means only "not recorded", and that is accepted. There are no negative extras.

### `models`

```js
{ _id: "2600", label: "Goodyear Derby", suggestedCategory: "footwear.shoes" }
```

- A model number is unique across the whole archive. Earlier cases of one number under two type letters were data errors.
- `suggestedCategory` pre-fills a garment's category. A garment may differ from it, and review flags the mismatch rather than blocking it.
- Type is **not** stored on the model.
- The initial list is generated from every model seen on existing garments. Each entry gets a proposed name (from the most common title) and a proposed category (majority vote), and is then verified by hand.

## Garment

```js
{
  gender:        "m",
  model:         "2600",                // required; must exist in models
  material:      "leather.horse.cors",  // any materials node
  color:         "black.010",           // any colors node, including a family
  type:          "a",
  category:      "footwear.shoes",      // pre-filled from model.suggestedCategory
  procedure:     ["r", "in"],           // [String] — was Mixed (string | string[])
  process:       ["ptc"],               // [String] — was String
  extras:        ["rubber-drip.black", "prosthetic.elbow"],
  overrideTitle: null,                  // String | null

  // unchanged
  imageGroupId, images, status, uploadedByUserId, source, ingest, timestamps
}
```

Every vocabulary field stores the referenced node's `_id` (its slug), never its code. The code is looked up from the node when the article code is rendered. Model numbers are already plain digits, so a model's slug is its number.

`title` is removed as a stored field.

### Title

The displayed title is `overrideTitle ?? models[model].label`.

- `overrideTitle` is set only when someone deliberately edits the title. Clearing it brings back the derived title.
- Renaming a model updates every garment without an override.
- Search indexes the displayed title, so it must be resolved (or denormalised) wherever titles are searched.

Extras may contribute to the derived title later. That is not part of this pass.

### Identity

A garment's identity is **gender + model + material + color**, in that order.

- Procedure, process, extras and type are not part of identity.
- Material and color compare by exact node id. A family-only color is a different identity from any code beneath it: `M 2600 CORS black` ≠ `M 2600 CORS black.010`.
- Ingest deduplication remains per site key (`ingest.source` + `ingest.siteKey`). Identity defines what counts as "the same garment" across sources and for similar-garment matching. It is not a unique index.

### Article code

The article code is rendered, never stored:

```
{type.code}{gender.code}/{model}[-{procedure.code…}]  {material.code}[-{process.code…}]/{color.code}
```

Procedures and processes are joined with `-`. When the material or color is a node without a code (a family or grouping node), that segment is omitted, as the short and medium code forms already do.

### Publishing rules

- An unknown model blocks publishing: the model must exist in `models` first.
- Unknown values in any other vocabulary keep blocking, as today.
- Extras never block publishing.

## Migration outline

The data moves to a **new cluster** (`MONGODB_URL_2`, database `wikipoell`). The current cluster (`MONGODB_URL`) is only ever read, so falling back means pointing the app at it again.

1. ✅ Model list generated from live data, verified by hand, seeded into `models`.
2. ✅ `colors` and `materials` trees built and verified by hand.
3. ✅ Flat collections (`types`, `genders`, `procedures`, `processes`) seeded from `Property`.
4. ✅ Garments copied and rewritten by `scripts/migrate-garments.mjs`:
   - color and material codes become node ids via `seed/value-map.json`
   - `process` and `procedure` become `[String]` of slugs
   - `title` and `__v` are dropped; `overrideTitle: null` and `extras: []` are added
   - `category` is taken from the model's `suggestedCategory` whenever the garment has a model
   - hand fixes for missing or single-layer materials and colors come from `seed/garment-fixes.json`
   - a garment without a model becomes `pending`
   - `_id`, images, `source`, `ingest` and timestamps are kept unchanged, so garment URLs survive
5. ✅ `users`, `homepagebackgrounds` and `ingestruns` copied as they are. `agentcorrections` is deliberately **not** copied; it stays in the old cluster until the ingest pipeline is reworked.
6. Switch the webapp over (the code changes below), re-running the migration with `--apply --replace` just before, so edits made in the meantime are included. Then retire `Property`.
7. Extras: not migrated yet. Every garment starts with `extras: []`.

Setting up a cluster from scratch:

```bash
node scripts/setup-db.mjs                      # collections, validators, indexes, vocabulary
node scripts/migrate-garments.mjs              # dry run: report only
node scripts/migrate-garments.mjs --apply      # add --replace to re-run
```

Both scripts take `--db <name>` to build a different database on the same cluster. Local development uses `wikipoell-dev`, built the same way and refreshed by re-running the migration with `--replace`. Production (`wikipoell`) is never touched from a laptop.

The webapp and the ingest pipeline must not point at the new cluster before their code is updated. Both still write the old format, and the new cluster's validators reject it.

### Webapp surfaces affected

- **Vocabulary readers:** `lib/properties.js`, `components/context/property-context-provider.jsx`, `app/layout.jsx`, `app/api/properties/`
- **Admin:**
  - vocabulary management: `app/admin/properties/`, `app/api/admin/property/`, `components/admin/properties/`, `components/admin/shared/property-modal.jsx`
  - review: `field-with-add.jsx`, `garment-field-grid.jsx`, `garment-review-card.jsx`
- **Garment forms and display:** `app/garment/create/page.jsx`, `app/garment/[slug]/page.jsx`, `components/garment/edit-garment-modal.jsx`, `components/garment/garment-card.jsx`
- **Filtering and search:**
  - `components/filter/filter-menu-client.jsx` (becomes tree filters)
  - `app/category/[...slug]/` and `lib/garments.js` (fix the segment-boundary prefix match, and escape user-supplied ids before they go into a regex)
  - `app/api/search-suggestions/`
  - `lib/garments.js`, including `getSimilarGarments`
- **Review logic and helpers:** `lib/admin-garment-properties.js`, `lib/ingest-review.js`, `lib/ingest-reevaluate.js`, `lib/patch-garment.js` (`normalizeProcedure` goes away), `lib/garment-utils.js` (`getGarmentCode`)
- **Ingest (deferred):** `app/api/ingest/context/`, `wikipoell-ingest/ingest/normalize/vocabulary.py`, `models.py`
