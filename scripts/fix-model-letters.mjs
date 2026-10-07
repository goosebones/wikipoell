/**
 * Repair for models that swallowed their procedure letters.
 *
 *   node scripts/fix-model-letters.mjs            # dry run
 *   node scripts/fix-model-letters.mjs --apply    # do it
 *
 * `SHORT` and `MEDIUM` in ingest/normalize/article_code.py used to capture
 * `[0-9]+[A-Z]*` as the model, so `OM/2656OD-IN` became model "2656OD" instead
 * of model 2656 with procedures OD and IN. The parser is fixed; this repairs
 * what it already wrote. Two distinct groups, handled differently:
 *
 *   closetcase (12, pending, never reviewed)
 *     Leave the fields alone — clearing `ingest.contentHash` makes the next
 *     run see them as changed, so the fixed parser rewrites them itself and
 *     the review/routing metadata stays consistent with the code that wrote it.
 *
 *   the-library (2, published, human-reviewed)
 *     Not the pipeline's doing: these came from the March 2026 legacy import,
 *     which put the whole code in `model` while also filling type, gender,
 *     material, process and colour correctly. The pipeline may never touch a
 *     reviewed garment, so set `model` directly. Only that one field changes.
 */

import { resolve } from "path";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const APPLY = process.argv.includes("--apply");

/** Expected: the whole article code sitting in `model`, e.g. `MM2544-IN`. */
const LEGACY_MODEL = /^[A-Z]{2}([0-9]+)(?:-[A-Z]+)?$/;

function fail(message) {
  console.error(`\n✖ ${message}\nNothing was changed.`);
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const G = mongoose.connection.collection("garments");

  console.log(
    APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to execute)\n",
  );

  const affected = await G.find(
    { model: /[A-Za-z]/ },
    { projection: { model: 1, status: 1, ingest: 1, type: 1, gender: 1 } },
  ).toArray();

  const reprocess = [];
  const rewrite = [];

  for (const g of affected) {
    const reviewed = Boolean(g.ingest?.humanReviewedAt);
    const legacy = LEGACY_MODEL.exec(String(g.model));

    if (legacy) {
      // Whole code in `model`; digits are the model. Only touch it if the rest
      // of the code was parsed out correctly — otherwise we are guessing.
      if (!g.type || !g.gender) {
        fail(
          `${g._id} has model "${g.model}" but no type/gender to corroborate it.`,
        );
      }
      rewrite.push({ _id: g._id, from: g.model, to: legacy[1] });
    } else if (!reviewed && g.ingest?.source) {
      reprocess.push({ _id: g._id, model: g.model, siteKey: g.ingest.siteKey });
    } else {
      fail(
        `${g._id} ("${g.model}") fits neither group — reviewed=${reviewed}.`,
      );
    }
  }

  console.log(`garments with letters in model : ${affected.length}`);
  console.log(`  rewrite model directly       : ${rewrite.length}`);
  console.log(`  clear hash, let pipeline fix : ${reprocess.length}`);

  console.log("\nrewrite:");
  for (const r of rewrite) console.log(`  ${r._id}  ${r.from}  ->  ${r.to}`);
  console.log("\nreprocess on next closetcase run:");
  for (const r of reprocess)
    console.log(`  ${r._id}  ${String(r.model).padEnd(8)} ${r.siteKey}`);

  if (!APPLY) {
    console.log("\nDry run complete. Nothing changed.");
    await mongoose.disconnect();
    return;
  }

  console.log("\napplying…");
  for (const r of rewrite) {
    await G.updateOne({ _id: r._id }, { $set: { model: r.to } });
  }
  for (const r of reprocess) {
    await G.updateOne({ _id: r._id }, { $unset: { "ingest.contentHash": "" } });
  }
  console.log(
    `  rewrote ${rewrite.length} models, cleared ${reprocess.length} hashes`,
  );

  const left = await G.countDocuments({ model: LEGACY_MODEL });
  const stale = await G.countDocuments({
    _id: { $in: reprocess.map((r) => r._id) },
    "ingest.contentHash": { $exists: true },
  });
  console.log(
    `\nverify: legacy-shaped models remaining = ${left} (expect 0), hashes still set = ${stale} (expect 0)`,
  );
  if (left !== 0 || stale !== 0) process.exitCode = 1;

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
