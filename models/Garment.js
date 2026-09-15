import mongoose from "mongoose";

/** Legacy garments: string. New garments may use string (single) or string[] (multiple). */
function procedureValidator(value) {
  if (value == null || value === "") return true;
  if (typeof value === "string") return true;
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "string" && v.trim().length > 0);
  }
  return false;
}

/**
 * Set only on garments created or touched by the ingest pipeline
 * (wikipoell-ingest). Absent on user submissions.
 */
const IngestReviewSchema = new mongoose.Schema(
  {
    required: Boolean,
    reasons: { type: [String], default: undefined },
    stage: String, // "deterministic" | "llm"
    fields: mongoose.Schema.Types.Mixed, // { material: { value, confidence, origin }, … }
    llm: {
      model: String,
      confidence: Number,
      notes: String,
    },
  },
  { _id: false },
);

const IngestSchema = new mongoose.Schema(
  {
    source: String, // "ccp-room", "the-library", …
    siteKey: String, // stable per-site id; derivation is per source
    sourceUrl: String,
    contentHash: String,
    runId: String, // run that created it
    lastRunId: String, // run that last touched it
    firstSeenAt: Date,
    lastSeenAt: Date,
    // Set whenever an admin publishes or edits. Once set, the pipeline only
    // refreshes lastSeenAt/contentHash and appends images — never fields.
    humanReviewedAt: Date,
    review: IngestReviewSchema,
  },
  { _id: false },
);

const GarmentSchema = new mongoose.Schema(
  {
    imageGroupId: String,
    category: String,
    type: String,
    gender: String,
    procedure: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: procedureValidator,
        message:
          "procedure must be a non-empty string, an array of non-empty strings, or null/omitted",
      },
    },
    material: String,
    process: String,
    color: String,
    title: String,
    model: String,
    images: [
      {
        url: { type: String, required: true },
        // Where the pipeline fetched it from, before the R2 copy. Each upload
        // gets a fresh UUID URL, so this is the only stable key for "do we
        // already have this image?" on a re-scrape. Absent on user uploads.
        sourceUrl: String,
      },
    ],
    status: {
      type: String,
      enum: ["pending", "published", "rejected"],
      default: "pending",
    },
    uploadedByUserId: {
      type: String,
      required: true,
    },
    source: {
      type: {
        type: String,
        enum: ["me", "external"],
      },
      label: String,
      url: String,
    },
    ingest: IngestSchema,
  },
  {
    timestamps: true,
  },
);

// One document per listing per site. Partial so user submissions (no ingest
// subdocument) are unaffected.
GarmentSchema.index(
  { "ingest.source": 1, "ingest.siteKey": 1 },
  {
    unique: true,
    partialFilterExpression: { "ingest.siteKey": { $exists: true } },
  },
);

export default mongoose.models.Garment ||
  mongoose.model("Garment", GarmentSchema);
