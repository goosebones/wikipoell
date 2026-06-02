/**
 * Scrapes ccp-room.com/catalog/ and writes a JSON file of garments ready for review.
 *
 * Images are kept as original ccp-room.com URLs at this stage — R2 upload happens
 * during the final import step (scripts/import-ccp-room.js).
 *
 * Usage:
 *   node scripts/scrape-ccp-room.js
 *
 * Output:
 *   ccp-room-garments.json  — array of garment objects, one per product
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const CATALOG_URL = "https://www.ccp-room.com/catalog/";
const BASE_URL = "https://www.ccp-room.com";
const OUTPUT = path.resolve(__dirname, "../ccp-room-garments.json");

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

function mapCategory(section, title) {
  const t = title.toUpperCase();

  if (section === "leather") {
    if (t.includes("PARKA")) return "outerwear.parkas";
    if (t.includes("BOMBER")) return "outerwear.bombers";
    if (t.includes("BLAZER")) return "outerwear.blazers";
    if (t.includes("VEST")) return "outerwear.vests";
    if (
      t.includes("JACKET") ||
      t.includes("BIKER") ||
      t.includes("RIDER") ||
      t.includes("MOTO")
    )
      return "outerwear.leatherJackets";
    if (
      t.includes("TRENCH") ||
      t.includes("COAT") ||
      t.includes("CABAN") ||
      t.includes("OVERCOAT") ||
      t.includes("CAPE")
    )
      return "outerwear.coats";
    return "outerwear";
  }

  if (section === "clothes") {
    if (t.includes("TROUSERS") || t.includes("PANTS")) return "bottoms.trousers";
    if (t.includes("SHORTS")) return "bottoms.shorts";
    if (t.includes("SKIRT")) return "bottoms.skirts";
    if (t.includes("DENIM") || t.includes("JEANS")) return "bottoms.denim";
    if (t.includes("SWEATPANTS") || t.includes("JOGGER")) return "bottoms.sweatpants";
    if (t.includes("DRESS")) return "tops.dresses";
    if (t.includes("HOODIE") || t.includes("SWEATSHIRT")) return "tops.hoodiesAndSweatshirts";
    if (t.includes("SWEATER") || t.includes("KNIT") || t.includes("KNITWEAR") || t.includes("PULLOVER"))
      return "tops.sweatersAndKnitwear";
    if (t.includes("TANK") || t.includes("SLEEVELESS")) return "tops.tankTopsAndSleeveless";
    if (t.includes("POLO")) return "tops.polos";
    if (t.includes("BLOUSE")) return "tops.blouses";
    if (t.includes("SHIRT")) return "tops.shirts";
    if (t.includes("LONG SLEEVE") || t.includes("LS T-SHIRT") || t.includes("LS TSHIRT"))
      return "tops.longSleeveTshirts";
    if (t.includes("T-SHIRT") || t.includes("TSHIRT") || t.includes("TEE"))
      return "tops.shortSleeveTshirts";
    if (t.includes("VEST")) return "outerwear.vests";
    if (t.includes("JACKET")) return "outerwear.jackets";
    if (t.includes("COAT") || t.includes("TRENCH")) return "outerwear.coats";
    // Default for clothes: try tops first
    return "tops";
  }

  if (section === "footwear") {
    if (t.includes("BOOT") || t.includes("ANKLE")) return "footwear.boots";
    if (t.includes("SNEAKER") || t.includes("TRAINER") || t.includes("RUNNER"))
      return "footwear.sneakers";
    if (t.includes("HEEL") || t.includes("PUMP") || t.includes("STILETTO"))
      return "footwear.heels";
    if (t.includes("FLAT") || t.includes("SLIPPER") || t.includes("MULE"))
      return "footwear.flats";
    // Derby, Oxford, Brogue, etc. → shoes
    return "footwear.shoes";
  }

  if (section === "accessories") {
    if (t.includes("BAG") || t.includes("TOTE") || t.includes("BACKPACK") || t.includes("CLUTCH") || t.includes("POUCH"))
      return "accessories.bags";
    if (t.includes("BELT")) return "accessories.belts";
    if (t.includes("GLOVE")) return "accessories.gloves";
    if (t.includes("SCARF") || t.includes("STOLE") || t.includes("WRAP"))
      return "accessories.scarves";
    if (t.includes("HAT") || t.includes("CAP") || t.includes("BERET") || t.includes("BEANIE"))
      return "accessories.hats";
    if (t.includes("TIE") || t.includes("NECKTIE")) return "accessories.ties";
    if (t.includes("SOCK")) return "accessories.socks";
    if (t.includes("RING")) return "accessories.jewelry.rings";
    if (t.includes("NECKLACE") || t.includes("CHAIN") || t.includes("PENDANT"))
      return "accessories.jewelry.necklaces";
    if (t.includes("BRACELET") || t.includes("CUFF") || t.includes("BANGLE"))
      return "accessories.jewelry.bracelets";
    if (t.includes("EARRING")) return "accessories.jewelry.earrings";
    if (t.includes("GLASSES") || t.includes("SUNGLASSES") || t.includes("EYEWEAR"))
      return "accessories.glasses";
    return "accessories";
  }

  // objects — no matching top-level category, leave null for manual assignment
  return null;
}

// ---------------------------------------------------------------------------
// Article code parser  e.g. "LM/2203 CORSS-PTC/19*"
// ---------------------------------------------------------------------------

function parseArticle(article) {
  // Pattern: {type}{gender}/{1,2}{model}{attachedProc}[-{dashProc}] {material}[-{process}]/{color}
  // Handles:
  //   "LM/2699-IN BIMS-PTC/19"      → model=2699, proc=[IN], material=BIMS, process=PTC
  //   "LM/2638R-IN CORS-PTC/010"    → model=2638, proc=[R,IN], material=CORS, process=PTC
  //   "LM//2399 BIMS-PTC/12"        → double slash before model
  //   "OM/2734-IN XITCH/7"          → no process segment
  const match = article.trim().match(
    /^([A-Z])([MF])\/{1,2}([0-9]+)([A-Z]*)(?:-([A-Z/]+))?\s+([A-Z]+)(?:-([A-Z]+))?\/(.+?)\s*$/
  );
  if (!match) return { type: null, gender: null, model: null, procedure: null, material: null, process: null, color: null };
  const [, type, gender, model, attachedProc, dashProc, material, process, color] = match;
  const procedures = [attachedProc, dashProc].filter(Boolean);
  const procedure = procedures.length === 0 ? null : procedures.length === 1 ? procedures[0] : procedures;
  return { type, gender, model, procedure, material, process: process || null, color };
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetch(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// HTML parser (regex — all data is in data-* attributes)
// ---------------------------------------------------------------------------

function extractAttr(tag, name) {
  const match = tag.match(new RegExp(`data-${name}="([^"]*)"`, "i"));
  return match ? match[1] : null;
}

function parseSection(html, sectionId) {
  // Extract the section block — terminated by the next section or end of info__inner
  const sectionMatch = html.match(
    new RegExp(`id="${sectionId}"[\\s\\S]*?(?=<div class="info__wrap" id="|<\\/div>\\s*<\\/div>\\s*<\\/div>\\s*<\\/div>\\s*<\\/section>|$)`)
  );
  if (!sectionMatch) return [];

  const sectionHtml = sectionMatch[0];

  // Extract all <a class="info__catalog-item" ...> opening tags
  const itemTagRegex = /<a[\s\S]*?class="info__catalog-item"[\s\S]*?>/g;
  const tags = [];
  let m;
  while ((m = itemTagRegex.exec(sectionHtml)) !== null) {
    // Each item has the class twice (on the outer <a> and inner), dedupe by data-id
    if (m[0].includes("data-id=")) {
      tags.push(m[0]);
    }
  }

  return tags;
}

function buildGarment(tag, section) {
  const name = extractAttr(tag, "name") || "";
  const article = extractAttr(tag, "article") || "";
  const color = extractAttr(tag, "color");
  const composition = extractAttr(tag, "composition");
  const imgRaw = extractAttr(tag, "img") || "";
  const hrefMatch = tag.match(/href="([^"]+)"/);
  const anchor = hrefMatch ? hrefMatch[1] : "";

  // Images: comma-separated relative paths → absolute URLs
  const images = imgRaw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ url: `${BASE_URL}${p}` }));

  const { type, gender, model, procedure, material, process, color: colorParsed } = parseArticle(article);

  // Title: strip trailing /COLOR from data-name, then convert to title case
  const rawTitle = name.replace(/\/[^/]+$/, "").trim();
  const title = rawTitle.toLowerCase().replace(/(^|[\s\-.])\w/g, (m) => m.toUpperCase());

  const category = mapCategory(section, title);

  return {
    title,
    article,
    category,
    type,
    gender,
    model,
    procedure: procedure || null,
    material: material || null,
    process: process || null,
    color: color || colorParsed || null,
    composition: composition || null,
    images,
    uploadedByUserId: "user_3Cz3hoOIt5jvBMDYqvt5tRSo8DC",
    source: {
      type: "external",
      label: "CCP-ROOM",
      url: `${CATALOG_URL}${anchor}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Fetching ${CATALOG_URL} ...`);
  const html = await fetch(CATALOG_URL);
  console.log(`Fetched ${html.length} bytes.`);

  const sections = ["leather", "clothes", "footwear", "accessories", "objects"];
  const garments = [];
  const categoryCounts = {};

  for (const section of sections) {
    const tags = parseSection(html, section);
    console.log(`  ${section}: ${tags.length} products`);

    for (const tag of tags) {
      const garment = buildGarment(tag, section);
      garments.push(garment);
      const cat = garment.category || "(null)";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
  }

  console.log(`\nTotal garments: ${garments.length}`);
  console.log("\nCategory breakdown:");
  for (const [cat, count] of Object.entries(categoryCounts).sort()) {
    console.log(`  ${cat}: ${count}`);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(garments, null, 2));
  console.log(`\nWritten to: ${OUTPUT}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
