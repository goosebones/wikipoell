import IngestRun from "@/models/IngestRun";
import Garment from "@/models/Garment";
import { initMongo } from "@/lib/mongodb";

/** Recent runs, newest first, with a count of what is still published. */
export async function getIngestRuns({ limit = 30 } = {}) {
  await initMongo();
  const runs = await IngestRun.find({})
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean();
  if (runs.length === 0) return [];

  // How much of each run is still live — the number that matters when
  // deciding whether to pull one.
  const ids = runs.map((r) => r._id);
  const counts = await Garment.aggregate([
    { $match: { "ingest.runId": { $in: ids } } },
    {
      $group: {
        _id: "$ingest.runId",
        total: { $sum: 1 },
        published: {
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
        },
      },
    },
  ]);
  const byRun = Object.fromEntries(counts.map((c) => [c._id, c]));

  return runs.map((run) => ({
    ...JSON.parse(JSON.stringify(run)),
    garmentsCreated: byRun[run._id]?.total ?? 0,
    garmentsPublished: byRun[run._id]?.published ?? 0,
  }));
}

/**
 * Pull a whole run off the site: every garment it created that is still
 * published goes back to `pending`.
 *
 * This is the reason each garment carries a runId. Nothing is deleted, so the
 * garments land in the review queue rather than disappearing, and a run that
 * was only partly wrong can be salvaged by hand.
 */
export async function unpublishIngestRun(runId) {
  await initMongo();
  const run = await IngestRun.findById(runId).lean();
  if (!run) return null;

  const result = await Garment.updateMany(
    { "ingest.runId": runId, status: "published" },
    { $set: { status: "pending" } },
  );
  return { runId, unpublished: result.modifiedCount };
}
