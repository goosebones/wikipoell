/**
 * Imports garments from ccp-room-garments.json into MongoDB.
 *
 * For each garment:
 *   1. Downloads each image from ccp-room.com
 *   2. Converts to WebP via Sharp (quality 85, matching the upload pipeline)
 *   3. Uploads to R2 under <imageGroupId>/<uuid>.webp
 *   4. Inserts a Garment document with status: "pending"
 *
 * Usage:
 *   node scripts/import-ccp-room.js [--dry-run]
 *
 * --dry-run  Prints what would be done without downloading, uploading, or writing to MongoDB.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const http = require("http");

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, "../.env");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const {
  MONGODB_URL,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

for (const [k, v] of Object.entries({
  MONGODB_URL,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
})) {
  if (!v) {
    console.error(`Missing env var: ${k}`);
    process.exit(1);
  }
}

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[dry-run] No changes will be made.\n");

const fromArg = process.argv.find((a) => a.startsWith("--from="));
const FROM = fromArg ? parseInt(fromArg.split("=")[1], 10) : 0;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------
const mongoose = require("mongoose");
const sharp = require("sharp");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// ---------------------------------------------------------------------------
// R2 client
// ---------------------------------------------------------------------------
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const R2_BASE = R2_PUBLIC_URL.replace(/\/$/, "");

async function uploadToR2(buffer, key) {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
    })
  );
  return `${R2_BASE}/${key}`;
}

// ---------------------------------------------------------------------------
// Download helper (follows redirects)
// ---------------------------------------------------------------------------
function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Mongoose schema
// ---------------------------------------------------------------------------
const GarmentSchema = new mongoose.Schema(
  {
    imageGroupId: String,
    category: String,
    type: String,
    gender: String,
    procedure: mongoose.Schema.Types.Mixed,
    material: String,
    process: String,
    color: String,
    title: String,
    model: String,
    images: [{ url: { type: String, required: true } }],
    status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
    uploadedByUserId: String,
    source: {
      type: { type: String, enum: ["me", "external"] },
      label: String,
      url: String,
    },
  },
  { strict: false, timestamps: true }
);

const Garment =
  mongoose.models.Garment || mongoose.model("Garment", GarmentSchema, "garments");

// ---------------------------------------------------------------------------
// Normalize procedure (string | string[] | null)
// ---------------------------------------------------------------------------
function normalizeProcedure(procedure) {
  if (procedure == null || procedure === "") return null;
  if (typeof procedure === "string") {
    const t = procedure.trim();
    return t.length ? t : null;
  }
  if (Array.isArray(procedure)) {
    const cleaned = procedure.map((p) => p.trim()).filter((p) => p.length > 0);
    if (cleaned.length === 0) return null;
    return cleaned.length === 1 ? cleaned[0] : cleaned;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const inputPath = path.resolve(__dirname, "../ccp-room-garments.json");
  const garments = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(`Loaded ${garments.length} garments from ccp-room-garments.json`);
  if (FROM > 0) console.log(`Skipping first ${FROM} (already inserted)\n`);
  else console.log();

  if (!DRY_RUN) {
    await mongoose.connect(MONGODB_URL);
    console.log("Connected to MongoDB.\n");
  }

  let inserted = 0;
  let skipped = 0;
  let imagesFailed = 0;
  const errors = [];

  for (let gi = FROM; gi < garments.length; gi++) {
    const g = garments[gi];
    const imageGroupId = crypto.randomUUID();
    const uploadedImages = [];

    console.log(`[${gi + 1}/${garments.length}] ${g.title ?? "(no title)"} — ${g.images?.length ?? 0} image(s)`);

    for (const img of g.images ?? []) {
      const imageId = crypto.randomUUID();
      const key = `${imageGroupId}/${imageId}.webp`;

      if (DRY_RUN) {
        console.log(`  [dry-run] ${img.url.split("/").pop()} → ${R2_BASE}/${key}`);
        uploadedImages.push({ url: `${R2_BASE}/${key}` });
        continue;
      }

      try {
        const raw = await download(img.url);
        const webp = await sharp(raw).webp({ quality: 85 }).toBuffer();
        const newUrl = await uploadToR2(webp, key);
        console.log(`  ✓ ${img.url.split("/").pop()} → ${newUrl}`);
        uploadedImages.push({ url: newUrl });
      } catch (err) {
        console.error(`  ✗ Failed: ${img.url} — ${err.message}`);
        errors.push({ garment: g.title, url: img.url, error: err.message });
        imagesFailed++;
        // Keep original URL as fallback so the garment still has an image
        uploadedImages.push({ url: img.url });
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    if (uploadedImages.length === 0) {
      console.log(`  Skipping — no images.\n`);
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await Garment.create({
        imageGroupId,
        status: "pending",
        category: g.category ?? null,
        type: g.type ?? null,
        gender: g.gender ?? null,
        model: g.model ?? null,
        procedure: normalizeProcedure(g.procedure),
        material: g.material ?? null,
        process: g.process ?? null,
        color: g.color ?? null,
        title: g.title ?? null,
        images: uploadedImages,
        uploadedByUserId: g.uploadedByUserId ?? null,
        source: g.source ?? null,
      });
    }

    inserted++;
  }

  console.log("\n--- Summary ---");
  console.log(`Total garments : ${garments.length}`);
  console.log(`Inserted       : ${inserted}`);
  console.log(`Skipped        : ${skipped}`);
  console.log(`Images failed  : ${imagesFailed}`);

  if (errors.length > 0) {
    const errorLog = path.resolve(__dirname, "../import-ccp-room-errors.json");
    fs.writeFileSync(errorLog, JSON.stringify(errors, null, 2));
    console.log(`\nErrors written to: ${errorLog}`);
  }

  if (!DRY_RUN) await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
