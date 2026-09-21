import { randomUUID } from "crypto";
import Garment from "@/models/Garment";
import IngestRun from "@/models/IngestRun";
import { initMongo } from "@/lib/mongodb";
import { getProperties } from "@/lib/properties";
import { getCategories } from "@/lib/categories";
import { parseReviewReason } from "@/lib/ingest-review";

/**
 * Re-check the blockers recorded on pending pipeline garments, and publish
 * the ones nothing blocks any more.
 *
 * Most of the review queue is held up by vocabulary that does not exist yet —
 * one missing property value can account for dozens of garments. Adding it
 * should clear them all, without re-scraping anything: the pipeline already
 * recorded *why* each garment was held back, so the only question is whether
 * those reasons are still true.
 *
 * This deliberately re-derives only what it honestly can from stored state.
 * `code_unparseable` needs the original listing and `llm_low_confidence`
 * needs a model call, so both are preserved untouched — a garment carrying
 * one is never cleared by this.
 *
 * No LLM, no network, no field inference. Pure re-check.
 */

/** Reason kinds this can re-evaluate. Anything else survives by definition. */
const RECHECKABLE = new Set([
  "unknown_vocab",
  "unknown_category",
  "missing",
  "title_unformatted",
]);

function isEmpty(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Mirrors `is_well_formed()` in the pipeline's normalize/title.py. */
function titleIsWellFormed(title) {
  if (typeof title !== "string" || title.length < 3) return false;
  if (title.includes("/")) return false;
  return /[a-z]/i.test(title);
}

/**
 * Which of a garment's recorded reasons are still true?
 * @returns {string[]} the surviving reasons
 */
export function survivingReasons(garment, { vocabulary, categories }) {
  const reasons = garment?.ingest?.review?.reasons ?? [];
  return reasons.filter((raw) => {
    const { kind, field, value } = parseReviewReason(raw);
    if (!RECHECKABLE.has(kind)) return true;

    switch (kind) {
      case "unknown_vocab":
        // Still blocking only if the value is *still* absent.
        return !(vocabulary.get(field) ?? new Set()).has(value);
      case "unknown_category":
        return !categories.has(garment.category);
      case "missing":
        return isEmpty(garment[field]);
      case "title_unformatted":
        return !titleIsWellFormed(garment.title);
      default:
        return true;
    }
  });
}

async function loadVocabulary() {
  const [properties, categoryDocs] = await Promise.all([
    getProperties(),
    getCategories(),
  ]);
  const vocabulary = new Map();
  for (const p of properties) {
    if (!p.garmentKey || p.garmentValue == null) continue;
    if (!vocabulary.has(p.garmentKey)) vocabulary.set(p.garmentKey, new Set());
    vocabulary.get(p.garmentKey).add(String(p.garmentValue));
  }
  const categories = new Set(categoryDocs.map((c) => String(c._id)));
  return { vocabulary, categories };
}

/**
 * Work out what a re-evaluation would do. Writes nothing.
 *
 * @returns {Promise<{
 *   examined: number,
 *   willPublish: Array<{ _id, title, cleared: string[] }>,
 *   skippedEdited: Array<{ _id, title }>,
 *   stillBlocked: number,
 *   clearedBy: Array<{ reason: string, count: number }>,
 * }>}
 */
export async function previewReevaluation() {
  await initMongo();
  const { vocabulary, categories } = await loadVocabulary();

  const pending = await Garment.find(
    { status: "pending", "ingest.review.reasons.0": { $exists: true } },
    {
      title: 1,
      category: 1,
      type: 1,
      gender: 1,
      model: 1,
      procedure: 1,
      material: 1,
      process: 1,
      color: 1,
      "ingest.review.reasons": 1,
      "ingest.humanReviewedAt": 1,
    },
  ).lean();

  const willPublish = [];
  const skippedEdited = [];
  const clearedBy = new Map();
  let stillBlocked = 0;

  for (const garment of pending) {
    const before = garment.ingest.review.reasons;
    const after = survivingReasons(garment, { vocabulary, categories });
    if (after.length > 0) {
      stillBlocked++;
      continue;
    }
    // Everything that held this garment back is resolved.
    if (garment.ingest.humanReviewedAt) {
      // You have already edited this one; publishing it is your call, not the
      // pipeline's.
      skippedEdited.push({ _id: String(garment._id), title: garment.title });
      continue;
    }
    willPublish.push({
      _id: String(garment._id),
      title: garment.title,
      cleared: before,
    });
    for (const reason of before) {
      clearedBy.set(reason, (clearedBy.get(reason) ?? 0) + 1);
    }
  }

  return {
    examined: pending.length,
    willPublish,
    skippedEdited,
    stillBlocked,
    clearedBy: [...clearedBy.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Publish everything a preview says is clear.
 *
 * Recomputed rather than trusting ids from the client, so a stale preview
 * cannot publish something that is still blocked. Stamped with an `IngestRun`
 * so it appears in /admin/runs and the existing unpublish-by-run button
 * reverts it.
 */
export async function applyReevaluation() {
  const preview = await previewReevaluation();
  const ids = preview.willPublish.map((g) => g._id);

  if (ids.length === 0) {
    return { ...preview, runId: null, published: 0 };
  }

  const runId = randomUUID();
  const startedAt = new Date();
  await IngestRun.create({
    _id: runId,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    status: "completed",
    trigger: "manual",
    options: { sources: ["reevaluate"], dryRun: false },
    totals: {
      listingsFound: preview.examined,
      published: ids.length,
      needsReview: preview.stillBlocked,
    },
    sources: [
      {
        name: "reevaluate",
        status: "completed",
        listingsFound: preview.examined,
        published: ids.length,
        needsReview: preview.stillBlocked,
      },
    ],
  });

  // bulkWrite rather than updateMany so each garment keeps a record of what
  // was holding it back — the reasons stop being current, but throwing away
  // why a garment sat in the queue would lose the only audit trail there is.
  const result = await Garment.bulkWrite(
    preview.willPublish.map((g) => ({
      updateOne: {
        filter: { _id: g._id, status: "pending" },
        update: {
          $set: {
            status: "published",
            "ingest.lastRunId": runId,
            "ingest.review.required": false,
            "ingest.review.reasons": [],
            "ingest.review.clearedReasons": g.cleared,
            "ingest.review.clearedAt": startedAt,
          },
        },
      },
    })),
    { ordered: false },
  );

  return { ...preview, runId, published: result.modifiedCount };
}
