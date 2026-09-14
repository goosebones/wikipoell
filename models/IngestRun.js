import { Schema, model, models } from "mongoose";

/** Per-source counters. The same shape is summed into `totals`. */
const IngestSourceStatsSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    durationMs: Number,
    listingsFound: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    published: { type: Number, default: 0 },
    needsReview: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    // Set when the whole source threw — the "scraper broke" signal.
    error: String,
  },
  { _id: false },
);

const IngestErrorSchema = new Schema(
  {
    source: String,
    siteKey: String,
    url: String,
    message: String,
  },
  { _id: false },
);

/**
 * One document per invocation of the ingest pipeline. Its _id is the runId
 * stamped on every garment the run creates or touches, which is what makes a
 * bad run reversible in one action.
 */
const IngestRunSchema = new Schema(
  {
    _id: { type: String, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    durationMs: Number,
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    trigger: { type: String, default: "manual" }, // "cron" | "manual"
    options: {
      sources: { type: [String], default: undefined },
      dryRun: Boolean,
      images: String,
      limit: Number,
    },
    sources: { type: [IngestSourceStatsSchema], default: undefined },
    totals: Schema.Types.Mixed,
    // Per-listing failures, capped by the API. (`errors` is reserved by Mongoose.)
    failures: { type: [IngestErrorSchema], default: undefined },
  },
  { timestamps: true },
);

IngestRunSchema.index({ startedAt: -1 });

export default models.IngestRun || model("IngestRun", IngestRunSchema);
