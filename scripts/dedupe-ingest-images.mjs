/**
 * One-off repair for the duplicate images created by run 40324ab2.
 *
 *   node scripts/dedupe-ingest-images.mjs            # dry run
 *   node scripts/dedupe-ingest-images.mjs --apply    # do it
 *
 * The first full pipeline run re-copied every image of the 478 garments that
 * predated it, because those images carry no `sourceUrl` and so could not be
 * matched against the source listing. Each of them now holds its original
 * pictures plus a freshly-uploaded duplicate of each.
 *
 * The rule is narrow on purpose:
 *
 *   A garment with at least one image that has NO sourceUrl is pre-pipeline.
 *   On those, every image WITH a sourceUrl was added by that run — drop them,
 *   keep the originals and their order.
 *
 * Garments the pipeline itself created have no sourceUrl-less images at all,
 * so the rule never touches them. That distinction is what makes this safe:
 * the 7 garments from the earlier --limit 25 run look superficially similar
 * (only sourceUrl images) but are correct, and are left alone.
 *
 * Deleted R2 keys are written to a file so the objects can be removed
 * separately, after the database change is confirmed good.
 */

import { resolve } from "path";
import { writeFileSync } from "fs";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const APPLY = process.argv.includes("--apply");
const KEYS_OUT = resolve(import.meta.dirname, "../orphaned-r2-keys.json");

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

  const all = await G.find(
    {},
    { projection: { images: 1, title: 1, "ingest.source": 1 } },
  ).toArray();

  const plan = [];
  let untouchedPipeline = 0;
  let untouchedClean = 0;

  for (const garment of all) {
    const images = garment.images ?? [];
    const originals = images.filter((i) => !i.sourceUrl);
    const added = images.filter((i) => i.sourceUrl);

    if (originals.length === 0) {
      untouchedPipeline++; // created by the pipeline; every image is matchable
      continue;
    }
    if (added.length === 0) {
      untouchedClean++; // never had anything appended
      continue;
    }
    plan.push({
      _id: garment._id,
      title: garment.title,
      source: garment.ingest?.source,
      keep: originals,
      drop: added,
    });
  }

  const dropped = plan.reduce((n, p) => n + p.drop.length, 0);
  console.log(`garments examined            : ${all.length}`);
  console.log(`  pipeline-created (skipped) : ${untouchedPipeline}`);
  console.log(`  already clean    (skipped) : ${untouchedClean}`);
  console.log(`  to repair                  : ${plan.length}`);
  console.log(`images to remove             : ${dropped}`);

  const zero = plan.filter((p) => p.keep.length === 0);
  if (zero.length) {
    fail(`${zero.length} garment(s) would be left with no images.`);
  }

  console.log("\nsample:");
  for (const p of plan.slice(0, 5)) {
    console.log(
      `  ${String(p.keep.length).padStart(2)} kept, ${String(p.drop.length).padStart(2)} removed  ${p.title?.slice(0, 44)}`,
    );
  }

  if (!APPLY) {
    console.log("\nDry run complete. Nothing changed.");
    await mongoose.disconnect();
    return;
  }

  console.log("\napplying…");
  const keys = [];
  let updated = 0;
  for (const p of plan) {
    await G.updateOne({ _id: p._id }, { $set: { images: p.keep } });
    updated++;
    for (const image of p.drop) {
      // media-garment.wikipoell.com/<group>/<uuid>.webp -> <group>/<uuid>.webp
      keys.push(new URL(image.url).pathname.replace(/^\//, ""));
    }
  }
  console.log(`  repaired ${updated} garments, removed ${keys.length} images`);

  writeFileSync(KEYS_OUT, JSON.stringify(keys, null, 1));
  console.log(`  orphaned R2 keys written to ${KEYS_OUT}`);

  const stillMixed = await G.countDocuments({
    images: { $elemMatch: { sourceUrl: { $exists: false } } },
    "images.sourceUrl": { $exists: true },
  });
  const noImages = await G.countDocuments({ images: { $size: 0 } });
  console.log(
    `\nverify: garments still mixing original+added = ${stillMixed} (expect 0), with no images = ${noImages} (expect 0)`,
  );
  if (stillMixed !== 0 || noImages !== 0) process.exitCode = 1;

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
