# Database schema

The documents the app stores, collection by collection. `scripts/setup-db.mjs` applies the validators and indexes described here.

- The **model** is a first-class entity: a curated list with a name and a suggested category, and the basis of a garment's title.
- The **title** is derived from the model, with an explicit override.
- **Color** and **material** are hierarchical, so a query for a parent returns everything beneath it.
- **Extras** are optional, hierarchical attributes for motifs such as rubber drip, prosthetic, stained, spur biter, tank sole, self edge, reflective, gloved.
- Type, gender, procedure and process are flat. Type is not part of the category tree.

## Vocabulary collections

One collection per field. They share a base shape, and `lib/vocabulary.ts` loads them all in one call.

| Collection   | Shape                                       | Hierarchy           |
| ------------ | ------------------------------------------- | ------------------- |
| `models`     | `{ _id: "2600", label, suggestedCategory }` | flat                |
| `colors`     | `{ _id, label, code, parent }`              | any depth, path ids |
| `materials`  | `{ _id, label, code, parent }`              | any depth, path ids |
| `extras`     | `{ _id, label, parent }`                    | any depth, path ids |
| `types`      | `{ _id: slug, label, code }`                | flat                |
| `genders`    | `{ _id: slug, label, code }`                | flat                |
| `procedures` | `{ _id: slug, label, code }`                | flat                |
| `processes`  | `{ _id: slug, label, code }`                | flat                |
| `categories` | unchanged                                   | any depth, path ids |

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

  | Code      | Slug       |
  | --------- | ---------- |
  | `19*`     | `19-star`  |
  | `19**`    | `19-star2` |
  | `X=NIT`   | `x-nit`    |
  | `ON EDGE` | `on-edge`  |
  | `14 ORG`  | `14-org`   |
  | `010B`    | `010b`     |

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
- Unknown values in any other vocabulary block publishing.
- Extras never block publishing.

## User data

### `userFavorites`

Garments a user has marked as a favorite, added with the rebuild (milestone 13). A user's favorites show on their profile.

```js
{
  userId:    "user_2abc…",   // Clerk user id
  garmentId: ObjectId("…"),
  createdAt: ISODate("…")
}
```

- Unique on `userId` + `garmentId`.

### `suggestions`

Corrections suggested by signed-in users, added with the rebuild (milestone 14). They wait in the admin review queue.

```js
{
  userId:    "user_2abc…",
  target:    { collection: "garments", id: "6ab3…" },  // or models, categories, materials, colors
  field:     "color",            // which field, from the form's list for that target
  current:   "Black › 010 – Black (Leather)",  // what the field showed at the time
  proposed:  "Should be 10, it's fabric",       // free text
  note:      "",                  // optional
  status:    "open",              // "open" | "accepted" | "dismissed"
  createdAt: ISODate("…")
}
```

- `proposed` is free text. An admin applies an accepted suggestion with the edit screen, so it never writes to the target directly.
- `current` is recorded by the server, not taken from the form.

## Databases

All in the `carols-vision` Atlas cluster:

- `spur-biter` is production.
- `pinch-seam` is development.

To set up a new database, run `node scripts/setup-db.mjs --db <name>` (add `--dry-run` to preview), then copy the documents in from an existing database.
