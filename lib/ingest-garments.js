import { randomUUID } from "crypto";
import Garment from "@/models/Garment";
import { normalizeProcedure } from "@/lib/patch-garment";
import { ingestSystemUserId } from "@/lib/ingest-auth";

/** Classification fields the pipeline may set. Everything else is metadata. */
export const INGEST_GARMENT_FIELDS = [
  "title",
  "category",
  "type",
  "gender",
  "model",
  "procedure",
  "material",
  "process",
  "color",
];

/** Thrown for malformed requests; routes map it to a 400. */
export class IngestValidationError extends Error {
  status = 400;
}

/** Thrown when (source, siteKey) already exists; routes map it to a 409. */
export class IngestConflictError extends Error {
  status = 409;
  constructor(message, existingId) {
    super(message);
    this.existingId = existingId;
  }
}

function requireString(obj, key, label = key) {
  const v = obj?.[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new IngestValidationError(`${label} is required`);
  }
  return v.trim();
}

function pickFields(fields) {
  if (fields == null) return {};
  if (typeof fields !== "object" || Array.isArray(fields)) {
    throw new IngestValidationError("fields must be an object");
  }
  const out = {};
  for (const key of INGEST_GARMENT_FIELDS) {
    if (!(key in fields)) continue;
    out[key] =
      key === "procedure"
        ? normalizeProcedure(fields.procedure)
        : (fields[key] ?? null);
  }
  return out;
}

function normalizeImageUrls(images, { required }) {
  const list = Array.isArray(images)
    ? images
        .map((i) => (typeof i === "string" ? i : i?.url))
        .filter((u) => typeof u === "string" && u.length > 0)
    : [];
  if (required && list.length === 0) {
    throw new IngestValidationError("At least one image URL is required");
  }
  return [...new Set(list)];
}

function pickReview(review) {
  if (review == null) return undefined;
  if (typeof review !== "object") {
    throw new IngestValidationError("ingest.review must be an object");
  }
  return {
    required: !!review.required,
    reasons: Array.isArray(review.reasons)
      ? review.reasons.filter((r) => typeof r === "string")
      : [],
    stage: review.stage ?? null,
    fields: review.fields ?? null,
    llm: review.llm ?? undefined,
  };
}

/**
 * List what the pipeline needs for dedup and change detection — one row per
 * garment from `source`, deliberately tiny.
 */
export async function listIngestGarments(source) {
  if (!source) throw new IngestValidationError("source is required");
  const rows = await Garment.find(
    { "ingest.source": source },
    {
      "ingest.siteKey": 1,
      "ingest.contentHash": 1,
      "ingest.humanReviewedAt": 1,
      status: 1,
    },
  ).lean();
  return rows.map((g) => ({
    id: String(g._id),
    siteKey: g.ingest.siteKey,
    contentHash: g.ingest.contentHash ?? null,
    status: g.status,
    humanReviewedAt: g.ingest.humanReviewedAt ?? null,
  }));
}

/**
 * Create a garment from the pipeline. The server decides status and
 * attribution; the caller decides everything about the garment itself.
 */
export async function createIngestGarment(body) {
  if (typeof body?.publish !== "boolean") {
    throw new IngestValidationError("publish (boolean) is required");
  }
  const ingest = body.ingest;
  const source = requireString(ingest, "source", "ingest.source");
  const siteKey = requireString(ingest, "siteKey", "ingest.siteKey");
  const runId = requireString(ingest, "runId", "ingest.runId");
  const label = requireString(body.source, "label", "source.label");
  const sourceUrl =
    typeof body.source?.url === "string" ? body.source.url.trim() : undefined;

  const images = normalizeImageUrls(body.images, { required: true });
  const now = new Date();

  try {
    const doc = await Garment.create({
      ...pickFields(body.fields),
      imageGroupId: body.imageGroupId || randomUUID(),
      images: images.map((url) => ({ url })),
      status: body.publish ? "published" : "pending",
      uploadedByUserId: ingestSystemUserId(),
      source: { type: "external", label, ...(sourceUrl && { url: sourceUrl }) },
      ingest: {
        source,
        siteKey,
        sourceUrl: ingest.sourceUrl ?? sourceUrl,
        contentHash: ingest.contentHash ?? null,
        runId,
        lastRunId: runId,
        firstSeenAt: now,
        lastSeenAt: now,
        review: pickReview(ingest.review),
      },
    });
    return { id: String(doc._id), status: doc.status };
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await Garment.findOne(
        { "ingest.source": source, "ingest.siteKey": siteKey },
        { _id: 1 },
      ).lean();
      throw new IngestConflictError(
        `A garment for ${source}/${siteKey} already exists`,
        existing ? String(existing._id) : null,
      );
    }
    throw err;
  }
}

/**
 * Apply a re-scrape to an existing garment, honouring the policy from
 * DESIGN.md §6:
 *
 *   - lastSeenAt / lastRunId / contentHash are always refreshed
 *   - new images are always appended; existing ones are never removed
 *   - if a human has reviewed the garment, nothing else is touched
 *   - otherwise fields and review metadata are applied, and the status may
 *     move pending → published. It never moves in any other direction.
 *
 * Enforced here rather than trusted from the client, so a bug in the
 * pipeline cannot overwrite a person's edits.
 *
 * @returns {Promise<object | null>} summary, or null if not found
 */
export async function updateIngestGarment(id, body) {
  const runId = requireString(body, "runId");
  const garment = await Garment.findById(id);
  if (!garment) return null;

  const now = new Date();
  const set = {
    "ingest.lastSeenAt": now,
    "ingest.lastRunId": runId,
  };
  if (typeof body.ingest?.contentHash === "string") {
    set["ingest.contentHash"] = body.ingest.contentHash;
  }

  const existingUrls = new Set((garment.images ?? []).map((i) => i.url));
  const newImages = normalizeImageUrls(body.images, { required: false })
    .filter((url) => !existingUrls.has(url))
    .map((url) => ({ url }));

  const humanReviewed = !!garment.ingest?.humanReviewedAt;
  let applied = "touch";
  let status = garment.status;

  if (!humanReviewed) {
    applied = "full";
    Object.assign(set, pickFields(body.fields));
    const review = pickReview(body.ingest?.review);
    if (review) set["ingest.review"] = review;
    if (body.publish === true && garment.status === "pending") {
      set.status = "published";
      status = "published";
    }
  }

  await Garment.updateOne(
    { _id: garment._id },
    {
      $set: set,
      ...(newImages.length && { $push: { images: { $each: newImages } } }),
    },
  );

  return {
    id: String(garment._id),
    applied,
    status,
    humanReviewed,
    imagesAdded: newImages.length,
  };
}

/** Batch lastSeenAt bump for listings whose content hash did not change. */
export async function touchIngestGarments({ runId, ids }) {
  const run = requireString({ runId }, "runId");
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new IngestValidationError("ids (non-empty array) is required");
  }
  if (ids.length > 5000) {
    throw new IngestValidationError("ids: at most 5000 per request");
  }
  const result = await Garment.updateMany(
    { _id: { $in: ids } },
    { $set: { "ingest.lastSeenAt": new Date(), "ingest.lastRunId": run } },
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}
