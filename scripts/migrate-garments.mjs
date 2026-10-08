/**
 * Copy garments (and the collections that go with them) from the current
 * cluster to the new one, converting them to the schema in SCHEMA.md.
 *
 *   node scripts/migrate-garments.mjs              # dry run: report only
 *   node scripts/migrate-garments.mjs --apply      # write to the new cluster
 *   node scripts/migrate-garments.mjs --apply --replace
 *                                                  # re-run: clear the target first
 *   node scripts/migrate-garments.mjs --apply --db wikipoell-dev
 *                                                  # write a different database
 *
 * Reads MONGODB_URL (never written to) and writes MONGODB_URL_2 (database
 * "wikipoell" unless --db names another). Vocabulary
 * comes from scripts/seed/, which setup-db.mjs has already loaded into the new
 * cluster. Refuses to write if any garment fails conversion.
 *
 * Extras are not migrated yet: every garment gets `extras: []`.
 * Agent corrections are deliberately not copied.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const apply = process.argv.includes("--apply");
const replace = process.argv.includes("--replace");
const dbFlag = process.argv.indexOf("--db");
const DB_NAME = dbFlag > 0 ? process.argv[dbFlag + 1] : "wikipoell";
const seed = (n) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "seed", `${n}.json`), "utf8"),
  );

// Collections copied as they are.
const VERBATIM = ["users", "homepagebackgrounds", "ingestruns"];

// One-off decisions made during review, keyed by garment _id.
const MODEL_FIXES = {
  "6aaac84dba5e10c6be5c1c9c": "2785", // Gravity X-Hot Feet
  "6aaac9c9ba5e10c6be5c1f5d": "2081", // Drip Track-U (Carpet)
};
const TYPE_FIXES = {
  "6aaacc34ba5e10c6be5c2518": "A", // Hair Tie, model 2082
};
// Retailer text misread as a process ("Silver Eye Ring" → SILVER-EYE).
const DROP_PROCESS = new Set(["EYE"]);

// ---------- vocabulary ----------
const byCode = (name) =>
  Object.fromEntries(seed(name).map((d) => [d.code, d._id]));
const codeMaps = {
  type: byCode("types"),
  gender: byCode("genders"),
  procedure: byCode("procedures"),
  process: byCode("processes"),
};
const valueMap = seed("value-map");
const modelCategory = Object.fromEntries(
  seed("models").map((m) => [m._id, m.suggestedCategory]),
);
const ids = (name) => new Set(seed(name).map((d) => d._id));
const known = {
  material: ids("materials"),
  color: ids("colors"),
  category: ids("categories"),
  type: ids("types"),
  gender: ids("genders"),
  procedure: ids("procedures"),
  process: ids("processes"),
};
const fixes = seed("garment-fixes");

// ---------- conversion ----------
const asList = (v) =>
  v == null || v === ""
    ? []
    : (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);

function convert(g) {
  const id = String(g._id);
  const errors = [];
  const notes = [];
  const lookup = (field, raw, map) => {
    if (raw == null || raw === "") return null;
    const v = map[raw];
    if (!v) errors.push(`${field} "${raw}" has no mapping`);
    return v ?? null;
  };

  // `|| null`, not `?? null`: some garments store an empty string.
  const model =
    MODEL_FIXES[id] ??
    ((typeof g.model === "string" ? g.model.trim() : g.model) || null);
  if (MODEL_FIXES[id]) notes.push(`model set to ${model}`);
  if (model && !modelCategory[model])
    errors.push(`model "${model}" not in models`);

  const rawType = TYPE_FIXES[id] ?? g.type;
  if (TYPE_FIXES[id]) notes.push(`type set to ${rawType}`);

  const processes = asList(g.process).filter((p) => {
    if (!DROP_PROCESS.has(p)) return true;
    notes.push(`process "${p}" dropped`);
    return false;
  });

  let material = lookup("material", g.material, valueMap.material);
  let color = lookup("color", g.color, valueMap.color);
  const fix = fixes[id];
  if (fix) {
    if ("material" in fix && fix.material !== material)
      notes.push(`material fixed: ${material} → ${fix.material}`);
    if ("color" in fix && fix.color !== color)
      notes.push(`color fixed: ${color} → ${fix.color}`);
    if ("material" in fix) material = fix.material;
    if ("color" in fix) color = fix.color;
  }

  // Category comes from the model whenever there is one.
  const category = model ? modelCategory[model] : g.category;
  if (category !== g.category)
    notes.push(`category ${g.category} → ${category}`);

  // A garment without a model cannot be published under the new rules.
  const status = model ? g.status : "pending";
  if (status !== g.status)
    notes.push(`status ${g.status} → ${status} (no model)`);

  const out = {
    _id: g._id,
    gender: lookup("gender", g.gender, codeMaps.gender),
    model,
    material,
    color,
    type: lookup("type", rawType, codeMaps.type),
    category,
    procedure: asList(g.procedure).map((p) =>
      lookup("procedure", p, codeMaps.procedure),
    ),
    process: processes.map((p) => lookup("process", p, codeMaps.process)),
    extras: [],
    overrideTitle: null,
    imageGroupId: g.imageGroupId,
    images: g.images,
    status,
    uploadedByUserId: g.uploadedByUserId,
    source: g.source,
    ingest: g.ingest,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };

  // Every reference must resolve against the new vocabulary.
  for (const field of ["material", "color", "category", "type", "gender"])
    if (out[field] != null && !known[field].has(out[field]))
      errors.push(`${field} "${out[field]}" not in vocabulary`);
  for (const field of ["procedure", "process"])
    for (const v of out[field])
      if (!known[field].has(v))
        errors.push(`${field} "${v}" not in vocabulary`);
  if (!out.uploadedByUserId) errors.push("no uploadedByUserId");
  // Mirrors the new cluster's validator, so a bad value fails here rather than
  // halfway through the insert.
  if (out.model != null && !/^[0-9]+$/.test(out.model))
    errors.push(`model "${out.model}" is not all digits`);

  return { out, errors, notes };
}

// ---------- run ----------
const source = await mongoose
  .createConnection(process.env.MONGODB_URL)
  .asPromise();
const target = await mongoose
  .createConnection(process.env.MONGODB_URL_2, { dbName: DB_NAME })
  .asPromise();
console.log(
  `${apply ? "APPLY" : "DRY RUN"}: ${source.db.databaseName} (old) → ${target.db.databaseName} (new)\n`,
);

const old = await source.db.collection("garments").find({}).toArray();
const results = old.map((g) => ({ g, ...convert(g) }));
const failed = results.filter((r) => r.errors.length);

// Report
const tally = (fn) => {
  const c = {};
  for (const r of results)
    for (const k of [].concat(fn(r) ?? [])) c[k] = (c[k] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
};
console.log(
  `garments: ${old.length} read, ${results.length - failed.length} converted, ${failed.length} failed`,
);
console.log(
  "changes:",
  tally((r) =>
    r.notes
      .map((n) => n.replace(/:.*|\s.*/, ""))
      .filter((n, i, a) => a.indexOf(n) === i),
  ),
);
console.log(
  "status after:",
  tally((r) => r.out.status),
);
console.log(
  "empty after: material",
  results.filter((r) => !r.out.material).length,
  "· color",
  results.filter((r) => !r.out.color).length,
  "· model",
  results.filter((r) => !r.out.model).length,
  "· type",
  results.filter((r) => !r.out.type).length,
);
const identity = {};
for (const { out } of results) {
  if (!out.model) continue;
  const k = [out.gender, out.model, out.material, out.color].join(" | ");
  (identity[k] ??= []).push(out.ingest?.source ?? out.source?.label);
}
const shared = Object.entries(identity).filter(([, v]) => v.length > 1);
console.log(
  `identity: ${Object.keys(identity).length} distinct; ${shared.length} shared by more than one garment ` +
    `(${shared.reduce((s, [, v]) => s + v.length, 0)} garments)`,
);
for (const r of results.filter((r) =>
  r.notes.some((n) => !n.startsWith("category")),
))
  console.log(
    `  ${r.g._id} ${r.g.title}: ${r.notes.filter((n) => !n.startsWith("category")).join("; ")}`,
  );
console.log("\nsample:");
for (const r of [
  results[0],
  results[Math.floor(results.length / 2)],
  results.at(-1),
]) {
  const {
    _id,
    gender,
    model,
    material,
    color,
    type,
    category,
    procedure,
    process: proc,
    status,
  } = r.out;
  console.log(`  ${_id} "${r.g.title}"`);
  console.log(
    `    old: ${r.g.type}${r.g.gender}/${r.g.model} ${JSON.stringify(r.g.procedure)} ${r.g.material}-${r.g.process}/${r.g.color} ${r.g.category}`,
  );
  console.log(
    `    new: ${JSON.stringify({ gender, model, material, color, type, category, procedure, process: proc, status })}`,
  );
}
for (const name of VERBATIM)
  console.log(
    `${name}: ${await source.db.collection(name).countDocuments()} to copy as-is`,
  );

if (failed.length) {
  console.log("\nFAILED:");
  for (const r of failed)
    console.log(`  ${r.g._id} ${r.g.title}: ${r.errors.join("; ")}`);
  console.log("\nNothing written.");
  process.exitCode = 1;
} else if (apply) {
  const all = ["garments", ...VERBATIM];
  for (const name of all) {
    const existing = await target.db.collection(name).countDocuments();
    if (existing && !replace) {
      console.log(
        `\n${name} already has ${existing} documents in the new cluster; re-run with --replace. Nothing written.`,
      );
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) {
    for (const name of all) {
      const docs =
        name === "garments"
          ? results.map((r) => r.out)
          : await source.db.collection(name).find({}).toArray();
      const col = target.db.collection(name);
      if (replace) await col.deleteMany({});
      if (docs.length) await col.insertMany(docs, { ordered: true });
      const count = await col.countDocuments();
      console.log(`\nwrote ${name}: ${count}/${docs.length}`);
      if (count !== docs.length) process.exitCode = 1;
    }
  }
} else {
  console.log("\nDry run: nothing written. Re-run with --apply.");
}

await source.close();
await target.close();
