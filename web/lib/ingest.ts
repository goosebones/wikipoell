// Ingest pipeline runs, for admins. Every garment carries the id of the run
// that created it, so a run that went wrong can be pulled off the site in one
// go: its garments that are still published go back to pending, into the
// review queue. Nothing is deleted, so a partly wrong run can be salvaged by
// hand. Unpublishing calls updateTag, so it runs from a server action.
import { updateTag } from "next/cache";
import { garments, ingestRuns } from "@/lib/db";

// The latest runs, newest first, each with how many garments it created and
// how many of those are still published.
export async function getRuns(limit = 50) {
  const runs = await ingestRuns
    .find()
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
  const counts = await garments
    .aggregate<{ _id: string; created: number; published: number }>([
      { $match: { "ingest.runId": { $in: runs.map((r) => r._id) } } },
      {
        $group: {
          _id: "$ingest.runId",
          created: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();
  const byRun = new Map(counts.map((c) => [c._id, c]));

  return runs.map((run) => {
    const sources = run.sources ?? [];
    const total = (
      key: "listingsFound" | "published" | "needsReview" | "failed",
    ) => sources.reduce((sum, s) => sum + (s[key] ?? 0), 0);
    return {
      id: run._id,
      startedAt: run.startedAt,
      durationMs: run.durationMs ?? null,
      status: run.status,
      trigger: run.trigger ?? null,
      sources: sources.map((s) => s.name),
      found: total("listingsFound"),
      published: total("published"),
      needsReview: total("needsReview"),
      failed: total("failed") + (run.failures?.length ?? 0),
      garments: byRun.get(run._id)?.created ?? 0,
      stillPublished: byRun.get(run._id)?.published ?? 0,
    };
  });
}

// Moves every still-published garment a run created back to pending.
// Returns how many moved.
export async function unpublishRun(runId: string) {
  if (!(await ingestRuns.countDocuments({ _id: runId }))) return 0;
  const result = await garments.updateMany(
    { "ingest.runId": runId, status: "published" },
    { $set: { status: "pending" }, $currentDate: { updatedAt: true } },
  );
  updateTag("garments");
  return result.modifiedCount;
}
