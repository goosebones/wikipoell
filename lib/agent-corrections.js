import AgentCorrection from "@/models/AgentCorrection";

/** Fields a correction is recorded over. Mirrors what the pipeline sets. */
const CORRECTION_FIELDS = [
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

const pick = (doc) =>
  Object.fromEntries(CORRECTION_FIELDS.map((f) => [f, doc?.[f] ?? null]));

/**
 * Record what an admin actually changed about a pipeline-created garment.
 *
 * These are the few-shot examples the LLM pass learns from, so this is the
 * loop that makes the pipeline better over time. It used to be driven by the
 * `/admin/agent` queue; now that classification happens before a garment
 * lands, it hangs off the ordinary admin edit instead.
 *
 * Only pipeline garments produce corrections — a user submission has no
 * machine proposal to compare against. Failure here is logged, never thrown:
 * losing a training example must not fail the admin's save.
 */
export async function recordAgentCorrection({ before, after }) {
  try {
    const review = before?.ingest?.review;
    if (!review?.fields) return null;

    const beforeFields = pick(before);
    const afterFields = pick(after);
    const changed = {};
    for (const field of CORRECTION_FIELDS) {
      if (
        JSON.stringify(beforeFields[field]) !==
        JSON.stringify(afterFields[field])
      ) {
        changed[field] = {
          before: beforeFields[field],
          after: afterFields[field],
        };
      }
    }

    await AgentCorrection.findOneAndUpdate(
      { garmentId: String(before._id) },
      {
        garmentId: String(before._id),
        before: beforeFields,
        agentProposed: review.fields,
        after: afterFields,
        changed,
        images: (after?.images ?? []).slice(0, 3).map((i) => i.url),
        source: "admin-review",
      },
      { upsert: true, new: true },
    );
    return { changed: Object.keys(changed) };
  } catch (err) {
    console.error("Failed to record agent correction:", err);
    return null;
  }
}
