/**
 * One-off migration for the ingest pipeline (DESIGN.md §5).
 *
 *   node scripts/migrate-ingest.mjs            # dry run: report only
 *   node scripts/migrate-ingest.mjs --apply    # do it
 *
 * Three things, by status:
 *   - published → backfilled with an `ingest` subdocument and marked
 *     human-reviewed, so the pipeline recognises them and never touches
 *     their fields
 *   - pending   → deleted; the pipeline re-discovers those listings fresh
 *   - agentproposals collection → dropped entirely; the new pipeline
 *     classifies before a garment lands, so there is no separate proposal
 *     step. AgentCorrection is KEPT — it records human judgement and feeds
 *     the LLM pass as few-shot examples.
 *
 * Guarded on invariants rather than exact counts, so ordinary review
 * activity between writing and running this does not trip it:
 *   - nothing has been migrated already
 *   - every published garment has a known source.label and a usable
 *     source.url
 *   - derived site keys are unique per source
 * The dry run prints the exact counts; read them before passing --apply.
 *
 * Site keys are derived per source and must match what the Python modules
 * compute:
 *   ccp-room     URL fragment   (single-page catalog: /catalog/#<slug>)
 *   the-library  URL pathname   (Shopify: /products/<handle>)
 */

import { resolve } from "path";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const APPLY = process.argv.includes("--apply");
const KEEP_PROPOSALS = process.argv.includes("--keep-proposals");

const SOURCES = {
  "CCP-ROOM": {
    name: "ccp-room",
    siteKey: (url) => new URL(url).hash.replace(/^#/, ""),
  },
  "The Library": {
    name: "the-library",
    siteKey: (url) => new URL(url).pathname.replace(/\/+$/, ""),
  },
};

function fail(msg) {
  console.error(`\n✖ ${msg}\nNothing was changed.`);
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const G = mongoose.connection.collection("garments");

  console.log(
    APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to execute)\n",
  );

  // ---- survey ------------------------------------------------------------
  const byStatus = Object.fromEntries(
    (
      await G.aggregate([
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]).toArray()
    ).map((r) => [r._id, r.n]),
  );
  const published = byStatus.published ?? 0;
  const pending = byStatus.pending ?? 0;
  const other = Object.entries(byStatus).filter(
    ([s]) => s !== "published" && s !== "pending",
  );
  console.log(`published: ${published}   pending: ${pending}`);
  if (other.length) console.log(`other statuses: ${JSON.stringify(other)}`);

  const alreadyMigrated = await G.countDocuments({
    "ingest.siteKey": { $exists: true },
  });
  if (alreadyMigrated > 0) {
    fail(
      `${alreadyMigrated} garments already have ingest.siteKey — this has run before.`,
    );
  }

  if (other.length) {
    fail(`Unexpected garment statuses present: ${JSON.stringify(other)}`);
  }
  if (published === 0) {
    fail("No published garments found — is this the right database?");
  }

  // ---- plan the backfill --------------------------------------------------
  const toBackfill = await G.find(
    { status: "published" },
    { projection: { source: 1, createdAt: 1, updatedAt: 1 } },
  ).toArray();

  const ops = [];
  const seen = new Map(); // `${source}/${siteKey}` → count
  const problems = [];
  const perSource = {};

  for (const g of toBackfill) {
    const label = g.source?.label;
    const url = g.source?.url;
    const spec = SOURCES[label];
    if (!spec) {
      problems.push(`${g._id}: unknown source.label ${JSON.stringify(label)}`);
      continue;
    }
    if (!url) {
      problems.push(`${g._id}: no source.url`);
      continue;
    }
    const siteKey = spec.siteKey(url);
    if (!siteKey) {
      problems.push(`${g._id}: empty siteKey from ${url}`);
      continue;
    }
    const k = `${spec.name}/${siteKey}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    perSource[spec.name] = (perSource[spec.name] ?? 0) + 1;

    ops.push({
      updateOne: {
        filter: { _id: g._id },
        update: {
          $set: {
            ingest: {
              source: spec.name,
              siteKey,
              sourceUrl: url,
              contentHash: null,
              firstSeenAt: g.createdAt ?? new Date(),
              lastSeenAt: g.updatedAt ?? new Date(),
              humanReviewedAt: g.updatedAt ?? new Date(),
            },
          },
        },
      },
    });
  }

  for (const [k, n] of seen) {
    if (n > 1) problems.push(`duplicate site key ${k} ×${n}`);
  }

  console.log(`\nbackfill plan: ${ops.length} garments`);
  for (const [name, n] of Object.entries(perSource)) {
    console.log(`  ${name.padEnd(12)} ${n}`);
  }
  console.log(`delete plan:   ${pending} pending garments`);

  const P = mongoose.connection.collection("agentproposals");
  const C = mongoose.connection.collection("agentcorrections");
  const proposals = await P.countDocuments();
  const corrections = await C.countDocuments();
  console.log(
    KEEP_PROPOSALS
      ? `proposals:     ${proposals} kept (--keep-proposals)`
      : `proposals:     ${proposals} AgentProposal docs to delete`,
  );
  console.log(
    `corrections:   ${corrections} AgentCorrection docs KEPT (feed the LLM pass)`,
  );

  if (problems.length) {
    console.log(`\nproblems (${problems.length}):`);
    problems.slice(0, 20).forEach((p) => console.log(`  - ${p}`));
    fail("Resolve the problems above first.");
  }
  if (ops.length !== published) {
    fail(
      `Planned ${ops.length} backfills for ${published} published garments.`,
    );
  }

  if (!APPLY) {
    console.log("\nDry run complete. Nothing changed.");
    await mongoose.disconnect();
    return;
  }

  // ---- apply ----------------------------------------------------------------
  console.log("\napplying…");

  await G.createIndex(
    { "ingest.source": 1, "ingest.siteKey": 1 },
    {
      unique: true,
      partialFilterExpression: { "ingest.siteKey": { $exists: true } },
      name: "ingest.source_1_ingest.siteKey_1",
    },
  );
  console.log("  index ensured");

  const bulk = await G.bulkWrite(ops, { ordered: false });
  console.log(`  backfilled ${bulk.modifiedCount}`);

  const del = await G.deleteMany({ status: "pending" });
  console.log(`  deleted ${del.deletedCount} pending garments`);

  if (!KEEP_PROPOSALS) {
    const delProposals = await P.deleteMany({});
    console.log(`  deleted ${delProposals.deletedCount} agent proposals`);
  }

  // ---- verify ---------------------------------------------------------------
  const total = await G.countDocuments();
  const keyed = await G.countDocuments({ "ingest.siteKey": { $exists: true } });
  const reviewed = await G.countDocuments({
    "ingest.humanReviewedAt": { $exists: true },
  });
  const proposalsLeft = await P.countDocuments();
  const correctionsLeft = await C.countDocuments();
  console.log(
    `\nverify: total=${total} keyed=${keyed} humanReviewed=${reviewed} (expected ${published} each)`,
  );
  console.log(
    `        proposals=${proposalsLeft} (expected ${KEEP_PROPOSALS ? proposals : 0}), ` +
      `corrections=${correctionsLeft} (expected ${corrections})`,
  );
  if (correctionsLeft !== corrections) {
    console.error(
      "✖ AgentCorrection count changed — these should never be touched",
    );
    process.exitCode = 1;
  }
  if (total !== published || keyed !== published || reviewed !== published) {
    console.error(
      "✖ verification mismatch — inspect before running the pipeline",
    );
    process.exitCode = 1;
  } else {
    console.log("✓ done");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
