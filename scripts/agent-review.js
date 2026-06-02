/**
 * Uses Claude to propose field corrections for pending CCP-ROOM garments.
 *
 * Reads correction examples from the AgentCorrection collection in MongoDB
 * and uses them as few-shot examples for each review.
 *
 * Usage:
 *   node scripts/agent-review.js [--limit=10] [--auto-apply-corrections]
 *
 * --limit=N    number of pending garments to process (default: 10)
 * --auto-apply-corrections      auto-apply corrections to MongoDB for garments with confidence >= 0.8
 *
 * Skips garments that already have any document in the agentproposals collection.
 */

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const { MONGODB_URL, ANTHROPIC_API_KEY } = process.env;
if (!MONGODB_URL) {
  console.error("Missing MONGODB_URL");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const AUTH_APPLY_CORRECTIONS = process.argv.includes(
  "--auto-apply-corrections",
);
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10;

import https from "https";
import http from "http";
import { randomUUID } from "crypto";
import { connect, model as _model, Schema, disconnect } from "mongoose";
import Anthropic from "@anthropic-ai/sdk";

const anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// Static context — categories and property values, will load from DB dynamically
// ---------------------------------------------------------------------------
let VALID_CATEGORIES = [];
let VALID_PROPERTIES = {};

// ---------------------------------------------------------------------------
// Title formatting (deterministic — same rule as the "Aa" button)
// ---------------------------------------------------------------------------
function formatTitle(raw) {
  if (!raw) return null;
  return raw
    .replace(/\/[^/\s]+$/, "") // strip trailing /COLOR suffix
    .trim()
    .replace(/\bO\.\s*DYED\b/gi, "Object Dyed") // O.DYED / O.Dyed / O. Dyed
    .replace(/\bO\.D\.\s*/gi, "Object Dyed ") // O.D.
    .replace(/\bL\.\s+JACKET\b/gi, "Leather Jacket")
    .replace(/\bL\.\s+JKT\b/gi, "Leather Jacket")
    .replace(/\bJKT\b/gi, "Jacket")
    .replace(/\bH\.\s+NECK\b/gi, "High Neck")
    .replace(/\s+/g, " ") // collapse any double spaces
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-.])\w/g, (m) => m.toUpperCase());
}

// ---------------------------------------------------------------------------
// Build the system prompt
// ---------------------------------------------------------------------------
function buildSystemPrompt(examples) {
  const propLines = Object.entries(VALID_PROPERTIES)
    .filter(([k]) =>
      [
        "type",
        "gender",
        "model",
        "procedure",
        "material",
        "process",
        "color",
      ].includes(k),
    )
    .map(
      ([k, vals]) =>
        `${k}: ${vals.map((v) => `${v.value} (${v.description})`).join(", ")}`,
    )
    .join("\n");

  const exampleBlocks = examples
    .map((ex, i) => {
      const changes =
        Object.keys(ex.changed)
          .filter((f) => f !== "title")
          .join(", ") || "none (only title formatted)";
      return `Example ${i + 1}:
  Before: title="${ex.before.title}", category=${ex.before.category}, type=${ex.before.type}, gender=${ex.before.gender}, model=${ex.before.model}, procedure=${ex.before.procedure}, material=${ex.before.material}, process=${ex.before.process}, color=${ex.before.color}
  After:  title="${ex.after.title}", category=${ex.after.category}, type=${ex.after.type}, gender=${ex.after.gender}, model=${ex.after.model}, procedure=${ex.after.procedure}, material=${ex.after.material}, process=${ex.after.process}, color=${ex.after.color}
  Fields changed: ${changes}`;
    })
    .join("\n\n");

  return `You are reviewing garment entries for Wikipoell, an archive of Carol Christian Poell (CCP) clothing.

Your job: look at the garment images and metadata, then output corrected field values.

RULES:
1. title: apply title case; strip any trailing /COLOR suffix (e.g. "/19", "/010", "/19*", "/12"); expand all abbreviations to full words. Common expansions: "O.D." or "O.Dyed" → "Object Dyed", "L." → "Leather", "JKT" → "Jacket", "H." → "High", "SP" in title context → "Spine". Always correct this.
2. category: choose from the valid list below. Must be at least 2 levels deep (e.g. "outerwear.coats" not just "outerwear"). Use the images to verify.
3. type, gender, model, material, process, color: choose from the valid lists below, this comes from the article code and is usually correct — only change if clearly wrong based on the images.
4. procedure: array of valid values, this comes from the article code and is usually correct — only change if clearly wrong based on the images.
5. confidence: 0.0–1.0 reflecting how certain you are about your proposed corrections overall.

VALID CATEGORIES (prefer 2-level deep):
${VALID_CATEGORIES.join(", ")}

VALID PROPERTY VALUES:
${propLines}

EXAMPLES OF PAST CORRECTIONS:
${exampleBlocks}

Respond with ONLY a JSON object — no explanation, no markdown:
{
  "title": "...",
  "category": "...",
  "type": "..." | null,
  "gender": "..." | null,
  "model": "..." | null,
  "procedure": [...],
  "material": "..." | null,
  "process": "..." | null,
  "color": "..." | null,
  "confidence": 0.0,
  "notes": "brief reasoning for any non-obvious decisions"
}`;
}

// ---------------------------------------------------------------------------
// Download image and return base64 + media_type
// ---------------------------------------------------------------------------
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return downloadImage(res.headers.location)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200)
          return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function mediaTypeFromUrl(url) {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  if (url.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

// ---------------------------------------------------------------------------
// Review a single garment
// ---------------------------------------------------------------------------
async function reviewGarment(garment, examples) {
  const systemPrompt = buildSystemPrompt(examples);

  const imageUrls = (garment.images || [])
    .slice(0, 4)
    .map((img) => img.url)
    .filter(Boolean);

  const imageBuffers = await Promise.all(
    imageUrls.map(async (url) => {
      try {
        const buf = await downloadImage(url);
        return {
          data: buf.toString("base64"),
          media_type: mediaTypeFromUrl(url),
        };
      } catch {
        return null;
      }
    }),
  );

  const imageContent = imageBuffers
    .filter(Boolean)
    .map(({ data, media_type }) => ({
      type: "image",
      source: { type: "base64", media_type, data },
    }));

  const userText = `Review this garment:
title: "${garment.title}"
category: ${garment.category ?? "null"}
type: ${garment.type ?? "null"}
gender: ${garment.gender ?? "null"}
model: ${garment.model ?? "null"}
procedure: ${garment.procedure ?? "null"}
material: ${garment.material ?? "null"}
process: ${garment.process ?? "null"}
color: ${garment.color ?? "null"}
`;
  const response = await anthropicClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [...imageContent, { type: "text", text: userText }],
      },
    ],
  });

  const text = response.content[0].text.trim();

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Pick few-shot examples — prefer ones with category/color changes
// ---------------------------------------------------------------------------
function pickExamples(corrections, n = 5) {
  const TRACKED = [
    "category",
    "type",
    "gender",
    "model",
    "procedure",
    "material",
    "process",
    "color",
  ];

  // Highest value: user corrected the agent's proposal on a non-title field
  const instancesAgentWasCorrected = corrections.filter(
    (c) =>
      c.agentProposed &&
      TRACKED.some(
        (f) =>
          JSON.stringify(c.agentProposed[f] ?? null) !==
          JSON.stringify((c.after ?? c.agentProposed)[f] ?? null),
      ),
  );

  // Good: non-title field changed (from original garment), but no agent correction on record
  const fieldChanged = corrections.filter(
    (c) =>
      !instancesAgentWasCorrected.includes(c) &&
      Object.keys(c.changed || {}).some((f) => f !== "title"),
  );

  // Least informative: title-only formatting changes
  const titleOnly = corrections.filter(
    (c) => !instancesAgentWasCorrected.includes(c) && !fieldChanged.includes(c),
  );

  return [
    ...instancesAgentWasCorrected.slice(0, Math.ceil(n * 0.5)),
    ...fieldChanged.slice(0, Math.ceil(n * 0.35)),
    ...titleOnly.slice(0, Math.floor(n * 0.15)),
  ].slice(0, n);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await connect(MONGODB_URL);
  console.log("Connected to MongoDB.\n");

  // Load valid property values from DB
  const PropModel = _model(
    "Property",
    new Schema({}, { strict: false }),
    "properties",
  );
  const props = await PropModel.find({}).lean();
  for (const p of props) {
    if (!VALID_PROPERTIES[p.garmentKey]) VALID_PROPERTIES[p.garmentKey] = [];
    VALID_PROPERTIES[p.garmentKey].push({
      value: p.garmentValue,
      description: p.description || p.garmentValue,
    });
  }

  // Load valid categories from DB
  const CategoryModel = _model(
    "Category",
    new Schema({}, { strict: false }),
    "categories",
  );
  const categories = await CategoryModel.find({}).lean();
  VALID_CATEGORIES = categories.map((c) => c._id);

  // Load correction examples from AgentCorrection collection
  const AgentCorrectionModel = _model(
    "AgentCorrection",
    new Schema({}, { strict: false }),
    "agentcorrections",
  );
  const corrections = await AgentCorrectionModel.find({}).lean();
  const examples = pickExamples(corrections);
  console.log(
    `Using ${examples.length} few-shot examples (${corrections.length} total corrections).\n`,
  );

  // Load pending garments without an existing proposal
  const AgentProposalModel = _model(
    "AgentProposal",
    new Schema({}, { strict: false }),
    "agentproposals",
  );
  const proposedGarmentIds = await AgentProposalModel.distinct("garmentId");

  const G = _model("Garment", new Schema({}, { strict: false }), "garments");
  const pendingQuery = {
    status: "pending",
    "source.label": "CCP-ROOM",
  };
  if (proposedGarmentIds.length > 0) {
    pendingQuery._id = { $nin: proposedGarmentIds };
  }
  const pending = await G.find(pendingQuery).limit(LIMIT).lean();

  console.log(
    `Processing ${pending.length} garments without existing proposals (limit=${LIMIT}, ${proposedGarmentIds.length} already proposed)...\n`,
  );

  const runId = randomUUID();
  const runAt = new Date();
  console.log(`Run ID: ${runId}\n`);

  const results = [];
  let autoApplied = 0;

  for (let i = 0; i < pending.length; i++) {
    const garment = pending[i];
    const num = `[${i + 1}]`;
    console.log(`${num} ${garment.title}`);

    let proposal;
    try {
      proposal = await reviewGarment(garment, examples);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      results.push({
        _id: String(garment._id),
        title: garment.title,
        error: err.message,
      });
      continue;
    }

    // Always apply deterministic title formatting
    proposal.title = formatTitle(garment.title);

    console.log(`  confidence: ${proposal.confidence}`);
    console.log(`  category: ${garment.category} → ${proposal.category}`);
    if (proposal.notes) console.log(`  notes: ${proposal.notes}`);

    const before = {
      title: garment.title,
      category: garment.category,
      type: garment.type,
      gender: garment.gender,
      model: garment.model,
      procedure: garment.procedure,
      material: garment.material,
      process: garment.process,
      color: garment.color,
    };

    await AgentProposalModel.findOneAndUpdate(
      { garmentId: String(garment._id), runId },
      {
        garmentId: String(garment._id),
        runId,
        runAt,
        model: "claude-sonnet-4-6",
        before,
        proposal,
        status: "pending",
      },
      { upsert: true, new: true },
    );

    results.push({ _id: String(garment._id), before, proposal });

    if (AUTH_APPLY_CORRECTIONS && proposal.confidence >= 0.8) {
      const { notes, confidence, ...fields } = proposal;
      await G.findByIdAndUpdate(garment._id, { $set: fields });
      console.log(`  ✓ Applied (confidence ${proposal.confidence})`);
      autoApplied++;
    }

    // Brief pause to avoid rate limits
    await new Promise((r) => setTimeout(r, 300));
    console.log();
  }

  console.log(`\n--- Summary ---`);
  console.log(`Run ID     : ${runId}`);
  console.log(`Processed  : ${results.length}`);
  if (AUTH_APPLY_CORRECTIONS)
    console.log(`Auto-applied (confidence >= 0.8): ${autoApplied}`);

  await disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
