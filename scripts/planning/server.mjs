// Throwaway: planning site for the rebuild. Delete this folder when done.
// Serves the feature list (choices saved to features-review.json) and four
// look-and-feel mockups that render real garments from the new cluster.
import { createServer } from "http";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

const dir = import.meta.dirname;
const reviewPath = resolve(dir, "features-review.json");
process.loadEnvFile(resolve(dir, "../../.env"));

const conn = await mongoose.createConnection(process.env.MONGODB_URL_2).asPromise();
const db = conn.db;
const load = async (c) => Object.fromEntries((await db.collection(c).find({}).toArray()).map((d) => [d._id, d]));
const [models, colors, materials, categories, types, genders, procedures, processes] = await Promise.all(
  ["models", "colors", "materials", "categories", "types", "genders", "procedures", "processes"].map(load),
);
const garmentsRaw = await db
  .collection("garments")
  .aggregate([{ $match: { status: "published", model: { $ne: null }, "images.2": { $exists: true } } }, { $sample: { size: 48 } }])
  .toArray();
const counts = {
  garments: await db.collection("garments").countDocuments({ status: "published" }),
  models: Object.keys(models).length,
};
// Counts per top-level color family and material group, for the filter mockups.
const tally = async (field) =>
  Object.fromEntries(
    (await db.collection("garments").aggregate([{ $group: { _id: { $arrayElemAt: [{ $split: [`$${field}`, "."] }, 0] }, n: { $sum: 1 } } }]).toArray()).map((r) => [r._id, r.n]),
  );
const [colorCounts, materialCounts, categoryCounts] = await Promise.all([tally("color"), tally("material"), tally("category")]);
await conn.close();

const path = (map, id) => {
  const out = [];
  for (let n = map[id]; n; n = map[n.parent]) out.unshift(n.code ? `${n.code} – ${n.label}` : n.label ?? n.name);
  return out;
};
const garments = garmentsRaw.map((g) => ({
  id: String(g._id),
  title: g.overrideTitle ?? models[g.model]?.label,
  model: g.model,
  code: [
    `${types[g.type]?.code ?? ""}${genders[g.gender]?.code ?? ""}/${g.model}${g.procedure.length ? "-" + g.procedure.map((p) => procedures[p].code).join("-") : ""}`,
    `${materials[g.material]?.code ?? ""}${g.process.length ? "-" + g.process.map((p) => processes[p].code).join("-") : ""}/${colors[g.color]?.code ?? ""}`,
  ],
  category: path(categories, g.category),
  color: path(colors, g.color),
  material: path(materials, g.material),
  type: types[g.type]?.label,
  gender: genders[g.gender]?.label,
  procedure: g.procedure.map((p) => `${procedures[p].code} – ${procedures[p].label ?? ""}`),
  process: g.process.map((p) => `${processes[p].code} – ${processes[p].label ?? ""}`),
  source: g.source?.label,
  url: g.source?.url,
  images: g.images.slice(0, 6).map((i) => i.url),
}));
const roots = (map, cnt) =>
  Object.values(map)
    .filter((n) => !n.parent)
    .map((n) => ({ id: n._id, label: n.label ?? n.name, n: cnt[n._id] ?? 0, children: Object.values(map).filter((c) => c.parent === n._id).map((c) => c.label ?? c.name) }))
    .sort((a, b) => b.n - a.n);
const data = JSON.stringify({
  garments,
  counts,
  colorFamilies: roots(colors, colorCounts),
  materialGroups: roots(materials, materialCounts),
  categories: roots(categories, categoryCounts),
});

const send = (res, type, body) => {
  res.writeHead(200, { "content-type": type });
  res.end(body);
};
createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url === "/") return send(res, "text/html", readFileSync(resolve(dir, "index.html")));
  if (url === "/data") return send(res, "application/json", data);
  if (url === "/features") return send(res, "text/html", readFileSync(resolve(dir, "features.html")));
  if (url === "/features.json") return send(res, "application/json", readFileSync(resolve(dir, "features.json")));
  if (url === "/review" && req.method === "GET")
    return send(res, "application/json", existsSync(reviewPath) ? readFileSync(reviewPath) : "{}");
  if (url === "/review" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { id, value } = JSON.parse(body);
      const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, "utf8")) : {};
      review[id] = value;
      writeFileSync(reviewPath, JSON.stringify(review, null, 2));
      res.writeHead(204);
      res.end();
    });
    return;
  }
  const m = url.match(/^\/mockup\/([a-d])$/);
  if (m) return send(res, "text/html", readFileSync(resolve(dir, `mockup-${m[1]}.html`)));
  res.writeHead(404);
  res.end();
}).listen(4324, () => console.log(`planning: http://localhost:4324 (${garments.length} sample garments)`));
