// Garment queries. Only published garments are ever shown to the public.
// Grids are fed plain card data (id, title, code, cover photo and a few short
// labels) rather than raw documents, which carry ObjectIds and so can't be
// cached or sent to the browser as they are.
import { ObjectId } from "mongodb";
import { cacheLife, cacheTag } from "next/cache";
import { garments } from "@/lib/db";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { nodeLabel } from "@/lib/tree";
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

// One page (from 1) of published garments for the archive grid, and whether
// more pages follow. Cached for an hour per page and sort under the
// "garments" tag, so admin edits can refresh it.
export async function getGarmentCards(page: number, sort: Sort) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");

  const [vocab, items] = await Promise.all([
    getVocabulary(),
    garments
      .aggregate<Garment>(
        [
          { $match: { status: "published" } },
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

// A single published garment by its id, or null if the id is malformed or no
// published garment has it.
export async function getGarment(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return garments.findOne({ _id: new ObjectId(id), status: "published" });
}
