// Garment queries. Only published garments are ever shown to the public.
// Grids are fed plain card data (id, title, code, cover photo and a few short
// labels) rather than raw documents, which carry ObjectIds and so can't be
// cached or sent to the browser as they are. A grid can be narrowed to a scope:
// a category, color or material (that node and everything beneath it) or a
// model.
import { ObjectId } from "mongodb";
import { cacheLife, cacheTag } from "next/cache";
import { garments } from "@/lib/db";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { nodeLabel, subtree } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";
import type { Garment, TreeNode } from "@/types";

export const PER_PAGE = 48;

// TODO: revisit which sorts to offer. Title and model may not be very useful;
// choose the options that are (also listed under "Revisit" in PLAN.md).
export const SORTS = { newest: "Newest", model: "Model", title: "Title" };
export type Sort = keyof typeof SORTS;

// The sort named in the URL, or "newest" for anything unrecognized.
export function parseSort(value: unknown): Sort {
  return typeof value === "string" && Object.hasOwn(SORTS, value)
    ? (value as Sort)
    : "newest";
}

// What a grid is narrowed to; null means the whole archive.
export type Scope = {
  field: "category" | "color" | "material" | "model";
  id: string;
} | null;

const SCOPE_FIELDS = ["category", "color", "material", "model"];

// A scope sent from the browser (through a server action), checked before use.
export function parseScope(value: unknown): Scope {
  const v = value as Scope;
  return v && SCOPE_FIELDS.includes(v.field) && typeof v.id === "string"
    ? { field: v.field, id: v.id }
    : null;
}

// Published garments in the scope. Tree fields match the node and everything
// beneath it; a model matches exactly.
function scopeFilter(scope: Scope) {
  if (!scope) return { status: "published" as const };
  return {
    status: "published" as const,
    [scope.field]: scope.field === "model" ? scope.id : subtree(scope.id),
  };
}

export type GarmentCardData = {
  id: string;
  title: string;
  code: readonly [string, string];
  image?: string;
  material?: string;
  color?: string;
  category?: string;
};

// Each sort ends with `_id`, so the order is identical from page to page even
// when two garments tie.
const ORDER = {
  newest: { createdAt: -1, _id: -1 },
  model: { model: 1, createdAt: -1, _id: -1 },
  title: { title: 1, model: 1, _id: -1 },
} as const;

// One page (from 1) of published garments in the scope, and whether more
// pages follow. Cached for an hour per page, sort and scope under the
// "garments" tag, so admin edits can refresh it.
export async function getGarmentCards(page: number, sort: Sort, scope: Scope) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");

  const [vocab, items] = await Promise.all([
    getVocabulary(),
    garments
      .aggregate<Garment>(
        [
          { $match: scopeFilter(scope) },
          // Titles aren't stored: sorting by title looks up the model's name.
          ...(sort === "title"
            ? [
                {
                  $lookup: {
                    from: "models",
                    localField: "model",
                    foreignField: "_id",
                    as: "modelDoc",
                  },
                },
                {
                  $addFields: {
                    title: {
                      $ifNull: [
                        "$overrideTitle",
                        { $first: "$modelDoc.label" },
                      ],
                    },
                  },
                },
              ]
            : []),
          { $sort: ORDER[sort] },
          { $skip: (page - 1) * PER_PAGE },
          // One extra, only to learn whether another page exists.
          { $limit: PER_PAGE + 1 },
        ],
        // Model numbers are text; compare them as numbers ("2600" < "10735").
        { collation: { locale: "en", numericOrdering: true } },
      )
      .toArray(),
  ]);

  const label = (node?: TreeNode) => node && nodeLabel(node);

  return {
    cards: items.slice(0, PER_PAGE).map((garment): GarmentCardData => ({
      id: garment._id.toString(),
      title: garmentTitle(garment, vocab),
      code: articleCode(garment, vocab),
      image: garment.images[0]?.url,
      material: label(vocab.materials[garment.material ?? ""]),
      color: label(vocab.colors[garment.color ?? ""]),
      category: vocab.categories[garment.category ?? ""]?.label,
    })),
    hasMore: items.length > PER_PAGE,
  };
}

// How many published garments are in the scope. Cached like the cards.
export async function countGarments(scope: Scope) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");
  return garments.countDocuments(scopeFilter(scope));
}

// A single published garment by its id, or null if the id is malformed or no
// published garment has it.
export async function getGarment(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return garments.findOne({ _id: new ObjectId(id), status: "published" });
}

export type VariantCell = { count: number; garmentId: string };

// Which material × color combinations of a model exist, for the model page's
// matrix: per combination, how many published garments and the newest one's
// id. Rows and columns are the material and color ids that occur (null when a
// garment has none). Cached like the cards.
export async function getVariantMatrix(model: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");

  const groups = await garments
    .aggregate<{
      _id: { material: string | null; color: string | null };
      count: number;
      newest: ObjectId;
    }>([
      { $match: { status: "published", model } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: { material: "$material", color: "$color" },
          count: { $sum: 1 },
          newest: { $first: "$_id" },
        },
      },
    ])
    .toArray();

  const cells: Record<string, VariantCell> = {};
  for (const g of groups) {
    cells[`${g._id.material}|${g._id.color}`] = {
      count: g.count,
      garmentId: g.newest.toString(),
    };
  }
  return {
    materials: [...new Set(groups.map((g) => g._id.material))],
    colors: [...new Set(groups.map((g) => g._id.color))],
    cells,
  };
}

// How many published garments have each value of a field, keyed by value id
// (e.g. { "black.010": 343, ... } for color). Exact matches only; use
// rollUp() from lib/tree to add each count to its ancestors. Cached like the
// cards.
export async function getCounts(
  field: "category" | "color" | "material" | "model",
) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");

  const rows = await garments
    .aggregate<{ _id: string | null; n: number }>([
      { $match: { status: "published" } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ])
    .toArray();
  return Object.fromEntries(
    rows.filter((r) => r._id).map((r) => [r._id as string, r.n]),
  ) as Record<string, number>;
}
