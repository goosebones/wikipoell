/**
 * Create the collections, validators and indexes described in SCHEMA.md on
 * the new cluster, and seed the vocabulary in scripts/seed/.
 *
 *   node scripts/setup-db.mjs                    # MONGODB_URL_2, database "wikipoell"
 *   node scripts/setup-db.mjs --db wikipoell-dev  # a different database
 *   node scripts/setup-db.mjs --dry-run          # print the plan, write nothing
 *
 * Idempotent. Validators are (re)applied on every run. Seed documents are
 * inserted only when their _id is missing, so later edits are never
 * overwritten by a re-run.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const dbFlag = process.argv.indexOf("--db");
const DB_NAME = dbFlag > 0 ? process.argv[dbFlag + 1] : "wikipoell";
const dryRun = process.argv.includes("--dry-run");
const seedDir = resolve(import.meta.dirname, "seed");

// One slug segment: lowercase letters and digits, single hyphens between.
const SEG = "[a-z0-9]+(-[a-z0-9]+)*";
const FLAT_ID = `^${SEG}$`;
const PATH_ID = `^${SEG}(\\.${SEG})*$`;
// Category ids predate slugs and stay camelCase (SCHEMA.md).
const CATEGORY_ID = "^[a-zA-Z0-9]+(\\.[a-zA-Z0-9]+)*$";

const str = { bsonType: "string" };
const strOrNull = { bsonType: ["string", "null"] };
const strArray = { bsonType: "array", items: str };

/** Flat vocabulary: types, genders, procedures, processes. */
const flatVocabulary = {
  bsonType: "object",
  required: ["_id", "code"],
  properties: {
    _id: { bsonType: "string", pattern: FLAT_ID },
    code: str,
    label: strOrNull,
  },
};

/** Tree vocabulary: colors, materials (with code), extras (without). */
const treeVocabulary = (withCode) => ({
  bsonType: "object",
  required: ["_id", "label", "parent"],
  properties: {
    _id: { bsonType: "string", pattern: PATH_ID },
    label: str,
    parent: { bsonType: ["string", "null"], pattern: PATH_ID },
    ...(withCode ? { code: strOrNull } : {}),
  },
});

const uniqueCode = {
  key: { code: 1 },
  unique: true,
  partialFilterExpression: { code: { $type: "string" } },
};

const collections = {
  models: {
    validator: {
      bsonType: "object",
      required: ["_id", "label", "suggestedCategory"],
      properties: {
        _id: { bsonType: "string", pattern: "^[0-9]+$" },
        label: str,
        suggestedCategory: { bsonType: "string", pattern: CATEGORY_ID },
      },
    },
    indexes: [{ key: { suggestedCategory: 1 } }],
  },
  categories: {
    validator: {
      bsonType: "object",
      required: ["_id", "name", "parent"],
      properties: {
        _id: { bsonType: "string", pattern: CATEGORY_ID },
        name: str,
        parent: { bsonType: ["string", "null"], pattern: CATEGORY_ID },
      },
    },
    indexes: [{ key: { parent: 1 } }],
  },
  colors: {
    validator: treeVocabulary(true),
    indexes: [uniqueCode, { key: { parent: 1 } }],
  },
  materials: {
    validator: treeVocabulary(true),
    indexes: [uniqueCode, { key: { parent: 1 } }],
  },
  extras: {
    validator: treeVocabulary(false),
    indexes: [{ key: { parent: 1 } }],
  },
  types: { validator: flatVocabulary, indexes: [uniqueCode] },
  genders: { validator: flatVocabulary, indexes: [uniqueCode] },
  procedures: { validator: flatVocabulary, indexes: [uniqueCode] },
  processes: { validator: flatVocabulary, indexes: [uniqueCode] },

  garments: {
    // Shapes only. Whether a value exists in its vocabulary is the app's job:
    // the database cannot check references.
    validator: {
      bsonType: "object",
      required: ["status", "uploadedByUserId"],
      properties: {
        status: { enum: ["pending", "published", "rejected"] },
        uploadedByUserId: str,
        gender: { bsonType: ["string", "null"], pattern: FLAT_ID },
        model: { bsonType: ["string", "null"], pattern: "^[0-9]+$" },
        material: { bsonType: ["string", "null"], pattern: PATH_ID },
        color: { bsonType: ["string", "null"], pattern: PATH_ID },
        type: { bsonType: ["string", "null"], pattern: FLAT_ID },
        category: { bsonType: ["string", "null"], pattern: CATEGORY_ID },
        procedure: {
          bsonType: "array",
          items: { bsonType: "string", pattern: FLAT_ID },
        },
        process: {
          bsonType: "array",
          items: { bsonType: "string", pattern: FLAT_ID },
        },
        extras: {
          bsonType: "array",
          items: { bsonType: "string", pattern: PATH_ID },
        },
        overrideTitle: strOrNull,
        imageGroupId: str,
        images: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["url"],
            properties: { url: str, sourceUrl: str },
          },
        },
      },
    },
    indexes: [
      {
        key: { "ingest.source": 1, "ingest.siteKey": 1 },
        unique: true,
        partialFilterExpression: { "ingest.siteKey": { $exists: true } },
      },
      // Identity (SCHEMA.md): not unique, the same garment can come from
      // several sources.
      { key: { gender: 1, model: 1, material: 1, color: 1 } },
      { key: { status: 1 } },
      { key: { category: 1 } },
      { key: { color: 1 } },
      { key: { material: 1 } },
      { key: { extras: 1 } },
      { key: { "ingest.runId": 1 } },
    ],
  },

  // Unchanged from the current cluster.
  users: {
    indexes: [{ key: { userId: 1 }, unique: true }, { key: { deletedAt: 1 } }],
  },
  homepagebackgrounds: {
    indexes: [{ key: { imageUrl: 1 }, unique: true }, { key: { active: 1 } }],
  },
  agentcorrections: { indexes: [{ key: { garmentId: 1 }, unique: true }] },
  ingestruns: { indexes: [{ key: { startedAt: -1 } }] },
};

const conn = await mongoose
  .createConnection(process.env.MONGODB_URL_2, { dbName: DB_NAME })
  .asPromise();
const db = conn.db;
const existing = new Set(
  (await db.listCollections().toArray()).map((c) => c.name),
);
console.log(`${dryRun ? "[dry run] " : ""}database "${DB_NAME}"`);

for (const [name, { validator, indexes = [] }] of Object.entries(collections)) {
  const options = validator
    ? {
        validator: { $jsonSchema: validator },
        validationLevel: "strict",
        validationAction: "error",
      }
    : {};
  const seedPath = resolve(seedDir, `${name}.json`);
  const seed = existsSync(seedPath)
    ? JSON.parse(readFileSync(seedPath, "utf8"))
    : [];

  if (dryRun) {
    console.log(
      `  ${name}: ${existing.has(name) ? "exists" : "create"}, ${indexes.length} indexes, ${seed.length} seed docs`,
    );
    continue;
  }

  if (!existing.has(name)) await db.createCollection(name, options);
  else if (validator) await db.command({ collMod: name, ...options });

  const col = db.collection(name);
  for (const { key, ...opts } of indexes) await col.createIndex(key, opts);

  let inserted = 0;
  if (seed.length) {
    const res = await col.bulkWrite(
      seed.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc },
          upsert: true,
        },
      })),
    );
    inserted = res.upsertedCount;
  }
  const count = await col.countDocuments();
  console.log(
    `  ${name}: ${count} docs (${inserted} seeded), ${indexes.length} indexes`,
  );
}

await conn.close();
