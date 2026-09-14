import { randomUUID } from "crypto";
import IngestRun from "@/models/IngestRun";
import { IngestValidationError } from "@/lib/ingest-garments";

const RUN_STATUSES = ["running", "completed", "failed"];
const MAX_FAILURES = 200;

export async function createIngestRun(body = {}) {
  const doc = await IngestRun.create({
    _id: randomUUID(),
    startedAt: new Date(),
    status: "running",
    trigger: body.trigger === "cron" ? "cron" : "manual",
    options: {
      sources: Array.isArray(body.options?.sources)
        ? body.options.sources
        : undefined,
      dryRun: !!body.options?.dryRun,
      images: body.options?.images ?? undefined,
      limit: body.options?.limit ?? undefined,
    },
  });
  return { runId: doc._id, startedAt: doc.startedAt };
}

/**
 * Progress and completion. `sources`, `totals` and `failures` are replaced
 * wholesale — the client sends its full current state each time, which is
 * simpler than merging and cannot drift.
 */
export async function updateIngestRun(id, body = {}) {
  const set = {};
  if (body.status !== undefined) {
    if (!RUN_STATUSES.includes(body.status)) {
      throw new IngestValidationError("Invalid status");
    }
    set.status = body.status;
  }
  if (Array.isArray(body.sources)) set.sources = body.sources;
  if (body.totals && typeof body.totals === "object") set.totals = body.totals;
  if (Array.isArray(body.failures)) {
    set.failures = body.failures.slice(0, MAX_FAILURES);
  }

  const run = await IngestRun.findById(id);
  if (!run) return null;

  if (set.status && set.status !== "running" && !run.finishedAt) {
    const finishedAt = new Date();
    set.finishedAt = finishedAt;
    set.durationMs = finishedAt.getTime() - run.startedAt.getTime();
  }

  await IngestRun.updateOne({ _id: id }, { $set: set });
  return { runId: id, ...set };
}
