/**
 * Re-parses article codes from ccp-room-garments.json using the fixed regex
 * and updates MongoDB documents where type/material parsed as null.
 *
 * Matches documents by source.url (unique per catalog item).
 *
 * Usage:
 *   node scripts/backfill-article-codes.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

for (const line of fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const DRY_RUN = process.argv.includes("--dry-run");
if (DRY_RUN) console.log("[dry-run] No changes will be made.\n");

const mongoose = require("mongoose");

// Fixed parser — allows letter suffixes on model number (e.g. 2638R, 2638SP)
function parseArticle(rawArticle) {
  // Normalize: ≡ → = (appears in X≡NIT material codes), fix ? typo before color, collapse spaces
  let article = rawArticle.trim()
    .replace(/≡/g, "=")
    .replace(/\?(\d)/, "/$1")
    .replace(/\s{2,}/g, " ");

  // Full format: {TYPE}{GENDER}/{1,2}{MODEL}{attachedProc}[-{dashProc}] {MATERIAL}[-{PROCESS}]/{COLOR}
  const full = article.match(
    /^([A-Z])([MF])\/{1,2}([0-9]+)([A-Z=]*)(?:-([A-Z/=]+))?\s+([A-Z=]+)(?:-([A-Z]+))?\/(.+?)\s*$/
  );
  if (full) {
    const [, type, gender, model, attachedProc, dashProc, material, process, color] = full;
    const procedures = [attachedProc, dashProc].filter(Boolean);
    const procedure = procedures.length === 0 ? null : procedures.length === 1 ? procedures[0] : procedures;
    return { type, gender, model, procedure, material, process: process || null, color };
  }

  // Incomplete format: {TYPE}{GENDER}/{MODEL} — no material/process/color (metal accessories etc.)
  const incomplete = article.match(/^([A-Z])([MF])\/{1,2}([0-9]+[A-Z]*)\s*$/);
  if (incomplete) {
    const [, type, gender, model] = incomplete;
    return { type, gender, model, procedure: null, material: null, process: null, color: null };
  }

  return null;
}

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

async function main() {
  const garments = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../ccp-room-garments.json"), "utf8"));
  console.log(`Loaded ${garments.length} garments from JSON.\n`);

  // Build a map of source URL → parsed fields (only where parser now succeeds)
  const fixes = new Map();
  let parseable = 0;
  let stillNull = 0;

  for (const g of garments) {
    if (!g.article) continue;
    const parsed = parseArticle(g.article);
    if (!parsed) { stillNull++; continue; }
    if (!parsed.type) { stillNull++; continue; }
    parseable++;
    const url = g.source?.url;
    if (!url) continue;
    if (!fixes.has(url)) fixes.set(url, []);
    fixes.get(url).push({ ...parsed, title: g.title });
  }

  console.log(`Articles now parseable: ${parseable}`);
  console.log(`Still unparseable:      ${stillNull}`);
  console.log(`Unique source URLs to update: ${fixes.size}\n`);

  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to MongoDB.\n");
  }

  const G = DRY_RUN ? null : mongoose.model("Garment", new mongoose.Schema({}, { strict: false }), "garments");

  let updated = 0;
  let notFound = 0;

  for (const [sourceUrl, candidates] of fixes) {
    for (const parsed of candidates) {
      if (DRY_RUN) {
        console.log(`[dry-run] ${parsed.title}: type=${parsed.type}, material=${parsed.material}, procedure=${JSON.stringify(parsed.procedure)}`);
        updated++;
        continue;
      }

      // Match by source URL; if multiple candidates for same URL, also match title
      const query = { "source.url": sourceUrl, "source.label": "CCP-ROOM", type: null };
      if (candidates.length > 1) query.title = parsed.title;

      const result = await G.updateOne(query, {
        $set: {
          type: parsed.type,
          gender: parsed.gender,
          model: parsed.model,
          material: parsed.material,
          process: parsed.process,
          procedure: normalizeProcedure(parsed.procedure),
        },
      });

      if (result.matchedCount > 0) {
        updated++;
      } else {
        notFound++;
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Updated   : ${updated}`);
  console.log(`Not found : ${notFound}`);

  if (!DRY_RUN) await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
