/**
 * Build the candidate model list for hand verification (see SCHEMA.md).
 *
 *   node scripts/dump-model-list.mjs
 *
 * Read-only. Groups every garment, pending included, by model number and
 * writes two CSVs next to this repo's root:
 *
 *   model-list.csv          one row per model: proposed name + category
 *   model-list-missing.csv  garments with no model at all
 *
 * The proposal prefers what a person decided: titles and categories from
 * human-reviewed garments first, then published, then anything.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

await mongoose.connect(process.env.MONGODB_URL);
const garments = await mongoose.connection
  .collection("garments")
  .find(
    {},
    {
      projection: {
        title: 1,
        category: 1,
        type: 1,
        gender: 1,
        model: 1,
        status: 1,
        "source.label": 1,
        "source.url": 1,
        "ingest.source": 1,
        "ingest.humanReviewedAt": 1,
      },
    },
  )
  .toArray();
await mongoose.disconnect();

const tier = (g) =>
  g.ingest?.humanReviewedAt ? 0 : g.status === "published" ? 1 : 2;

const count = (values) => {
  const counts = new Map();
  for (const v of values) {
    if (v == null || v === "") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
};

/** Most common value among the most trusted tier that has any. */
const propose = (rows, key) => {
  for (const t of [0, 1, 2]) {
    const top = count(rows.filter((g) => tier(g) === t).map(key))[0];
    if (top) return top[0];
  }
  return "";
};

// Some retailers title a listing with its article code (`GF0813P / NUBEL 3`,
// `Mf0498`). Those say nothing about the name, so they are proposed only when
// nothing else exists.
const CODE_LIKE = /^[A-Z]{1,2}[MF]?\s*\/*\s*[0-9]{3,}/i;
const nameOf = (g) => {
  const t = g.title?.trim();
  return t && !CODE_LIKE.test(t) ? t : null;
};

/** One category is an ancestor of the other: `footwear` vs `footwear.boots`. */
const nested = (a, b) => a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

const fmt = (pairs, limit = Infinity) =>
  pairs
    .slice(0, limit)
    .map(([v, n]) => `${v} (${n})`)
    .join("; ");

const csv = (rows) =>
  rows
    .map((r) =>
      r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n") + "\n";

const byModel = new Map();
const missing = [];
for (const g of garments) {
  const model = typeof g.model === "string" ? g.model.trim() : g.model;
  if (!model) {
    missing.push(g);
    continue;
  }
  if (!byModel.has(model)) byModel.set(model, []);
  byModel.get(model).push(g);
}

const header = [
  "model",
  "proposedName",
  "proposedCategory",
  "garments",
  "humanReviewed",
  "published",
  "pending",
  "flags",
  "categories",
  "types",
  "genders",
  "titles",
  "sources",
];

const rows = [...byModel]
  .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
  .map(([model, gs]) => {
    const categories = count(gs.map((g) => g.category));
    const types = count(gs.map((g) => g.type));
    const flags = [
      !/^[0-9]+$/.test(model) && "non-numeric model",
      categories.length > 1 &&
        (categories.every(([a]) =>
          categories.every(([b]) => a === b || nested(a, b)),
        )
          ? "category parent/child"
          : "category conflict"),
      !gs.some(nameOf) && "name from code",
      types.length > 1 && "type conflict",
      !categories.length && "no category",
    ].filter(Boolean);
    return [
      model,
      propose(gs, nameOf) || propose(gs, (g) => g.title?.trim()),
      propose(gs, (g) => g.category),
      gs.length,
      gs.filter((g) => tier(g) === 0).length,
      gs.filter((g) => g.status === "published").length,
      gs.filter((g) => g.status === "pending").length,
      flags.join("; "),
      fmt(categories),
      fmt(types),
      fmt(count(gs.map((g) => g.gender))),
      fmt(count(gs.map((g) => g.title?.trim())), 8),
      fmt(count(gs.map((g) => g.ingest?.source ?? g.source?.label))),
    ];
  });

const root = resolve(import.meta.dirname, "..");
writeFileSync(resolve(root, "model-list.csv"), csv([header, ...rows]));
writeFileSync(
  resolve(root, "model-list-missing.csv"),
  csv([
    ["id", "status", "source", "title", "category", "type", "url"],
    ...missing.map((g) => [
      g._id,
      g.status,
      g.ingest?.source ?? g.source?.label,
      g.title,
      g.category,
      g.type,
      g.source?.url,
    ]),
  ]),
);

const flagged = rows.filter((r) => r[7]).length;
console.log(
  `${garments.length} garments → ${rows.length} models (${flagged} flagged), ${missing.length} without a model`,
);
