// Page metadata for search engines and link previews: a title, a description
// and a preview image (a real garment photo) for each garment, model and
// category, color or material page, plus its canonical address, and the
// sitemap's list of pages. Cached like the pages themselves, under "garments"
// (and the vocabulary), so metadata costs no extra database work.
import type { ObjectId } from "mongodb";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import * as db from "@/lib/db";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import {
  countGarments,
  getCounts,
  getGarment,
  getGarmentCards,
} from "@/lib/garments";
import { labelPath, nodeHref, nodeLabel, rollUp } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

// A page's metadata from its parts. Titles get " · Wikipoell" from the root
// layout's template.
function page(
  title: string,
  description: string,
  path: string,
  image?: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      images: image ? [image] : undefined,
    },
  };
}

// "1 garment", "74 garments".
const garmentCount = (n: number) => `${n} ${n === 1 ? "garment" : "garments"}`;

export async function garmentMetadata(id: string): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  cacheTag("garments", `garment:${id}`);

  const [vocab, garment] = await Promise.all([getVocabulary(), getGarment(id)]);
  if (!garment) return { title: "Not found" };
  const title = garmentTitle(garment, vocab);
  const label = (tree: "materials" | "colors", value: string | null) =>
    value && vocab[tree][value] ? nodeLabel(vocab[tree][value]) : null;
  const facts = [
    garment.category && vocab.categories[garment.category]?.label,
    label("materials", garment.material),
    label("colors", garment.color),
  ].filter(Boolean);
  const code = articleCode(garment, vocab).filter(Boolean).join(" ");
  const description = [
    `${title} by Carol Christian Poell.`,
    facts.length > 0 && `${facts.join(", ")}.`,
    code && `Article code ${code}.`,
  ]
    .filter(Boolean)
    .join(" ");
  return page(title, description, `/garment/${id}`, garment.images[0]?.url);
}

export async function modelMetadata(id: string): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  cacheTag("garments", "vocabulary");

  const vocab = await getVocabulary();
  const model = vocab.models[id];
  if (!model) return { title: "Not found" };
  const filters = { model: [id] };
  const [count, { cards }] = await Promise.all([
    countGarments(filters),
    getGarmentCards(1, "newest", filters),
  ]);
  return page(
    `${model.label} (${id})`,
    `Carol Christian Poell model ${id}, ${model.label}: ${garmentCount(count)} in the archive, with every material and color it was made in.`,
    `/model/${id}`,
    cards[0]?.image,
  );
}

const TREES = {
  category: { tree: "categories", base: "/category" },
  color: { tree: "colors", base: "/color" },
  material: { tree: "materials", base: "/material" },
} as const;

export async function nodeMetadata(
  field: keyof typeof TREES,
  id: string,
): Promise<Metadata> {
  "use cache";
  cacheLife("hours");
  cacheTag("garments", "vocabulary");

  const vocab = await getVocabulary();
  const { tree, base } = TREES[field];
  const node = vocab[tree][id];
  if (!node) return { title: "Not found" };
  const filters = { [field]: [id] };
  const [count, { cards }] = await Promise.all([
    countGarments(filters),
    getGarmentCards(1, "newest", filters),
  ]);
  const path = labelPath(vocab[tree], id).join(" › ");
  return page(
    nodeLabel(node),
    `${garmentCount(count)} by Carol Christian Poell in ${path}.`,
    nodeHref(base, id),
    cards[0]?.image,
  );
}

// Every public page with content, for the sitemap: the fixed pages, each
// published garment (with when it last changed), and each model, category,
// color and material that has garments.
export async function getSitemapEntries() {
  "use cache";
  cacheLife("hours");
  cacheTag("garments", "vocabulary");

  const [vocab, published, models, categories, colors, materials] =
    await Promise.all([
      getVocabulary(),
      db.garments
        .find({ status: "published" })
        .project<{ _id: ObjectId; updatedAt: Date }>({ updatedAt: 1 })
        .toArray(),
      getCounts("model"),
      getCounts("category"),
      getCounts("color"),
      getCounts("material"),
    ]);
  const nodes = (
    tree: "categories" | "colors" | "materials",
    counts: Record<string, number>,
    base: string,
  ) => Object.keys(rollUp(vocab[tree], counts)).map((id) => nodeHref(base, id));

  return [
    ...[
      "/",
      "/garments",
      "/codebook",
      "/model",
      "/category",
      "/color",
      "/material",
    ].map((path) => ({ path })),
    ...published.map((g) => ({
      path: `/garment/${g._id}`,
      lastModified: g.updatedAt,
    })),
    ...Object.keys(models).map((id) => ({ path: `/model/${id}` })),
    ...nodes("categories", categories, "/category").map((path) => ({ path })),
    ...nodes("colors", colors, "/color").map((path) => ({ path })),
    ...nodes("materials", materials, "/material").map((path) => ({ path })),
  ];
}
