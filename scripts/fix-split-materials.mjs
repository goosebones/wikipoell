/**
 * Rejoin materials that were split into material + process.
 *
 *   node scripts/fix-split-materials.mjs            # dry run
 *   node scripts/fix-split-materials.mjs --apply    # do it
 *
 * A hyphen in an article code usually separates the material from the process
 * (`CORS-PTC`), but some material names contain one themselves — or contain a
 * space that retailers write as a hyphen. `CON-EDGE` is the material
 * "CON EDGE", not "CON" processed with "EDGE", and both `CON` and `EDGE` are
 * real vocabulary values on their own, so nothing ever flagged it.
 *
 * Only the vocabulary can tell the two apart. `normalize()` now rejoins them
 * at parse time; this applies the same rule to garments already stored.
 *
 *   A. `material` + `process` spells a known material when rejoined
 *      (with a space or a hyphen) -> that is the material, and `process`
 *      is cleared because the token has been absorbed into it.
 *
 *   B. material is exactly `CON` and rule A did not apply -> `CON EDGE`,
 *      an explicit archive decision, not an inference.
 *
 * Human-reviewed garments are included: this corrects a value a person was
 * shown, not one they chose, and leaving them would split the archive.
 */

import { resolve } from "path";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const G = mongoose.connection.collection("garments");
  const P = mongoose.connection.collection("properties");

  console.log(
    APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to execute)\n",
  );

  const materials = new Set(
    (await P.find({ garmentKey: "material" }).toArray()).map(
      (p) => p.garmentValue,
    ),
  );
  if (!materials.has("CON EDGE")) {
    console.error(
      "✖ 'CON EDGE' is not in the material vocabulary. Add it first.",
    );
    process.exit(1);
  }

  const rows = await G.find(
    { $or: [{ process: { $nin: [null, ""] } }, { material: "CON" }] },
    {
      projection: {
        material: 1,
        process: 1,
        "ingest.source": 1,
        "ingest.humanReviewedAt": 1,
      },
    },
  ).toArray();

  const rejoin = [];
  const conOnly = [];
  for (const g of rows) {
    const m = g.material;
    const p = g.process;
    if (typeof m !== "string" || m === "") continue;
    let joined = null;
    if (typeof p === "string" && p !== "") {
      for (const j of [" ", "-"]) {
        if (materials.has(`${m}${j}${p}`)) {
          joined = `${m}${j}${p}`;
          break;
        }
      }
    }
    if (joined)
      rejoin.push({
        _id: g._id,
        from: `${m} + ${p}`,
        to: joined,
        src: g.ingest?.source,
        reviewed: !!g.ingest?.humanReviewedAt,
      });
    else if (m === "CON")
      conOnly.push({
        _id: g._id,
        from: `CON + ${p ?? "(none)"}`,
        to: "CON EDGE",
        src: g.ingest?.source,
        reviewed: !!g.ingest?.humanReviewedAt,
        keepProcess: p,
      });
  }

  const tally = (list) => {
    const out = {};
    for (const r of list) out[r.to] = (out[r.to] ?? 0) + 1;
    return out;
  };

  console.log(`garments examined                 : ${rows.length}`);
  console.log(
    `A. material+process rejoins        : ${rejoin.length}`,
    tally(rejoin),
  );
  console.log(`B. material CON (rule A missed it) : ${conOnly.length}`);
  console.log(
    `   human-reviewed among all changes: ${[...rejoin, ...conOnly].filter((r) => r.reviewed).length}`,
  );

  const bySrc = {};
  for (const r of [...rejoin, ...conOnly])
    bySrc[r.src ?? "user"] = (bySrc[r.src ?? "user"] ?? 0) + 1;
  console.log("   by source:", bySrc);

  console.log("\nA — rejoined (process cleared):");
  for (const r of rejoin.slice(0, 10))
    console.log(`   ${r.from.padEnd(20)} -> ${r.to}`);
  if (rejoin.length > 10) console.log(`   … ${rejoin.length - 10} more`);
  if (conOnly.length) {
    console.log("\nB — CON with no rejoin (process left alone):");
    for (const r of conOnly)
      console.log(
        `   ${r.from.padEnd(20)} -> ${r.to}   (process stays ${r.keepProcess ?? "(none)"})`,
      );
  }

  if (!APPLY) {
    console.log("\nDry run complete. Nothing changed.");
    await mongoose.disconnect();
    return;
  }

  console.log("\napplying…");
  const ops = [
    ...rejoin.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { material: r.to, process: null } },
      },
    })),
    ...conOnly.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { material: r.to } },
      },
    })),
  ];
  const result = await G.bulkWrite(ops, { ordered: false });
  console.log(`  modified ${result.modifiedCount} garments`);

  const left = await G.countDocuments({ material: "CON" });
  console.log(`\nverify: garments still on material CON = ${left} (expect 0)`);
  if (left !== 0) process.exitCode = 1;

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
