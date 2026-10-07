/**
 * Restore ink's titles to the site's own wording, and publish what that frees.
 *
 *   node scripts/dump-ink-titles.sh                      # see wikipoell-ingest/scripts
 *   node scripts/retitle-ink.mjs <titles.json>           # dry run
 *   node scripts/retitle-ink.mjs <titles.json> --apply   # do it
 *
 * ink-clothing.com gives every product one name: the article code in the h1.
 * There is no descriptive title to scrape. The pipeline reformatted that code
 * for display (`AM2795-IN / XWARTS 010` -> `Am2795-In / Xwarts 010`) and then
 * flagged the result `title_unformatted` because `is_well_formed()` rejects a
 * slash — so 567 ink garments sat in the queue waiting for a better title that
 * does not exist.
 *
 * The rule has changed: ink titles are published verbatim (`title_is_final` in
 * the pipeline). This applies that decision to the garments already stored —
 * title from the site, unmodified — and publishes the ones that title was the
 * only thing holding back.
 *
 * Deliberately narrow:
 *   - no field is touched but `title`
 *   - no re-scrape of images, no LLM, no re-derivation of anything else
 *   - a garment blocked by anything besides `title_unformatted` stays pending
 *   - human-reviewed garments are skipped entirely
 *
 * Like `lib/ingest-reevaluate.js`, the work is stamped with an IngestRun and
 * the reasons it resolved are kept as `clearedReasons` rather than discarded.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import mongoose from "mongoose";

process.loadEnvFile(resolve(import.meta.dirname, "../.env"));

const APPLY = process.argv.includes("--apply");
const TITLES = process.argv.find((a) => a.endsWith(".json"));
const TITLE_REASON = "title_unformatted";

function fail(message) {
  console.error(`\n✖ ${message}\nNothing was changed.`);
  process.exit(1);
}

async function main() {
  if (!TITLES) fail("Pass the titles JSON produced by dump_ink_titles.py.");
  const titles = JSON.parse(readFileSync(TITLES, "utf8"));
  const titleCount = Object.keys(titles).length;
  if (titleCount === 0) fail(`${TITLES} is empty.`);

  await mongoose.connect(process.env.MONGODB_URL);
  const G = mongoose.connection.collection("garments");

  console.log(
    APPLY ? "MODE: apply\n" : "MODE: dry run (pass --apply to execute)\n",
  );
  console.log(`titles scraped from ink : ${titleCount}`);

  const garments = await G.find(
    { "ingest.source": "ink", status: "pending" },
    {
      projection: {
        title: 1,
        "ingest.siteKey": 1,
        "ingest.review": 1,
        "ingest.humanReviewedAt": 1,
      },
    },
  ).toArray();

  const publish = [];
  const retitleOnly = [];
  const noTitle = [];
  const reviewed = [];

  for (const g of garments) {
    if (g.ingest?.humanReviewedAt) {
      reviewed.push(g);
      continue;
    }
    const raw = titles[g.ingest?.siteKey];
    if (typeof raw !== "string" || raw.trim() === "") {
      noTitle.push(g);
      continue;
    }
    const reasons = g.ingest?.review?.reasons ?? [];
    const rest = reasons.filter((r) => r !== TITLE_REASON);
    const entry = {
      _id: g._id,
      from: g.title,
      to: raw.trim(),
      cleared: reasons.filter((r) => r === TITLE_REASON),
      rest,
    };
    (rest.length === 0 ? publish : retitleOnly).push(entry);
  }

  console.log(`pending ink garments    : ${garments.length}`);
  console.log(`  retitle and PUBLISH   : ${publish.length}`);
  console.log(`  retitle, stay pending : ${retitleOnly.length}`);
  console.log(`  no title scraped      : ${noTitle.length}`);
  console.log(`  human-reviewed, skipped: ${reviewed.length}`);

  const changed = [...publish, ...retitleOnly].filter((e) => e.from !== e.to);
  console.log(`\ntitles that actually change: ${changed.length}`);
  for (const e of changed.slice(0, 8)) {
    console.log(`  ${String(e.from).padEnd(34)} -> ${e.to}`);
  }
  if (noTitle.length) {
    console.log("\nno scraped title (left alone):");
    for (const g of noTitle.slice(0, 8)) console.log(`  ${g.ingest?.siteKey}`);
  }

  if (!APPLY) {
    console.log("\nDry run complete. Nothing changed.");
    await mongoose.disconnect();
    return;
  }

  const runId = randomUUID();
  const startedAt = new Date();
  await mongoose.connection.collection("ingestruns").insertOne({
    _id: runId,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    status: "completed",
    trigger: "manual",
    options: { sources: ["ink-retitle"], dryRun: false },
    totals: {
      listingsFound: garments.length,
      updated: publish.length + retitleOnly.length,
      published: publish.length,
      needsReview: retitleOnly.length,
    },
    sources: [
      {
        name: "ink-retitle",
        status: "completed",
        listingsFound: garments.length,
        updated: publish.length + retitleOnly.length,
        published: publish.length,
        needsReview: retitleOnly.length,
      },
    ],
  });

  const ops = [
    ...publish.map((e) => ({
      updateOne: {
        filter: { _id: e._id, status: "pending" },
        update: {
          $set: {
            title: e.to,
            status: "published",
            "ingest.lastRunId": runId,
            "ingest.review.required": false,
            "ingest.review.reasons": [],
            "ingest.review.clearedReasons": e.cleared,
            "ingest.review.clearedAt": startedAt,
          },
        },
      },
    })),
    ...retitleOnly.map((e) => ({
      updateOne: {
        filter: { _id: e._id, status: "pending" },
        update: {
          $set: {
            title: e.to,
            "ingest.lastRunId": runId,
            "ingest.review.reasons": e.rest,
            "ingest.review.clearedReasons": e.cleared,
            "ingest.review.clearedAt": startedAt,
          },
        },
      },
    })),
  ];

  console.log(`\napplying… run ${runId}`);
  const result = await G.bulkWrite(ops, { ordered: false });
  console.log(`  modified ${result.modifiedCount} garments`);

  const stillFlagged = await G.countDocuments({
    "ingest.source": "ink",
    status: "pending",
    "ingest.review.reasons": TITLE_REASON,
  });
  const published = await G.countDocuments({
    "ingest.source": "ink",
    status: "published",
  });
  console.log(
    `\nverify: ink still flagged ${TITLE_REASON} = ${stillFlagged} (expect 0), published = ${published}`,
  );
  if (stillFlagged !== 0) process.exitCode = 1;

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
