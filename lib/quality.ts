// Data quality and bulk editing for admins. Each issue is a query over
// garments that aren't rejected: missing material or color, a material or
// color that's only a family (a grouping with no code of its own), and a
// category that differs from the model's suggested one. Models that no
// garment uses are listed too. Bulk edit sets, clears, adds or removes one
// field's value on many garments at once, the way the garment editor would.
// Reads are fresh per request; the bulk change calls updateTag, so it runs
// from a server action.
import { type Filter, ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { garments } from "@/lib/db";
import { EDIT_FIELDS, type EditField, LIST_FIELDS } from "@/lib/garment-edit";
import { filterQuery, type Filters } from "@/lib/filters";
import { toCard } from "@/lib/garments";
import {
  getVocabulary,
  type Vocabulary,
  vocabularyTrees,
} from "@/lib/vocabulary";
import type { Garment, TreeNode } from "@/types";

// Families: grouping nodes with no CCP code of their own ("Black", "Leather
// › Kangaroo") that have values beneath them, so a garment could be more
// specific. A coded value with variants beneath it (010, with 010B) isn't one.
const families = (tree: Record<string, TreeNode>) => {
  const parents = new Set(Object.values(tree).map((n) => n.parent));
  return Object.values(tree)
    .filter((n) => !n.code && parents.has(n._id))
    .map((n) => n._id);
};

export const ISSUES = {
  "no-material": {
    title: "No material",
    query: (): Filter<Garment> => ({ material: null }),
  },
  "no-color": {
    title: "No color",
    query: (): Filter<Garment> => ({ color: null }),
  },
  "family-material": {
    title: "Material is only a family",
    query: (vocab: Vocabulary): Filter<Garment> => ({
      material: { $in: families(vocab.materials) },
    }),
  },
  "family-color": {
    title: "Color is only a family",
    query: (vocab: Vocabulary): Filter<Garment> => ({
      color: { $in: families(vocab.colors) },
    }),
  },
  "category-differs": {
    title: "Category differs from the model’s",
    query: (vocab: Vocabulary): Filter<Garment> => ({
      $or: Object.values(vocab.models).map((m) => ({
        model: m._id,
        category: { $ne: m.suggestedCategory },
      })),
    }),
  },
} as const;
export type Issue = keyof typeof ISSUES;

export function isIssue(value: unknown): value is Issue {
  return typeof value === "string" && Object.hasOwn(ISSUES, value);
}

const notRejected = { status: { $ne: "rejected" as const } };

// How many garments each issue covers, and the models no garment uses.
export async function getQualityReport() {
  const vocab = await getVocabulary();
  const [counts, usedModels] = await Promise.all([
    Promise.all(
      (Object.keys(ISSUES) as Issue[]).map((issue) =>
        garments.countDocuments({
          ...notRejected,
          ...ISSUES[issue].query(vocab),
        }),
      ),
    ),
    garments.distinct("model", notRejected),
  ]);
  return {
    issues: (Object.keys(ISSUES) as Issue[]).map((issue, i) => ({
      issue,
      title: ISSUES[issue].title,
      count: counts[i],
    })),
    unusedModels: Object.values(vocab.models)
      .filter((m) => !usedModels.includes(m._id))
      .map((m) => ({ id: m._id, label: m.label })),
  };
}

// At most this many garments are shown for bulk editing at once.
export const BULK_LIMIT = 500;

// The garments a bulk edit would cover: those with an issue, or those
// passing archive-style filters. Newest first, as cards with their status.
export async function getBulkGarments(
  selection: { issue: Issue } | { filters: Filters },
) {
  const vocab = await getVocabulary();
  const query =
    "issue" in selection
      ? ISSUES[selection.issue].query(vocab)
      : filterQuery(selection.filters);
  const docs = await garments
    .find({ ...notRejected, ...query })
    .sort({ createdAt: -1, _id: -1 })
    .limit(BULK_LIMIT + 1)
    .toArray();
  return {
    garments: docs.slice(0, BULK_LIMIT).map((g) => ({
      ...toCard(g, vocab),
      status: g.status,
    })),
    more: docs.length > BULK_LIMIT,
  };
}

// What a bulk edit does to its field: set (or clear, with no value) a
// single-value field, or add or remove a value in a list field.
export type BulkOp = "set" | "add" | "remove";

// Applies one change to many garments, after checking the field, the
// operation and the value against the vocabulary. Setting a model also sets
// each garment's category to the model's suggested one. The garments are
// marked human-reviewed, as an edit in the editor would. Returns how many
// changed, or why nothing did.
export async function applyBulkEdit(
  ids: string[],
  field: EditField,
  op: BulkOp,
  value: string | null,
) {
  const vocab = await getVocabulary();
  const list = LIST_FIELDS.has(field);
  if (!EDIT_FIELDS.includes(field)) return { error: "Choose a field." };
  if (list === (op === "set")) return { error: "That doesn’t fit the field." };
  if (value !== null && !Object.hasOwn(vocabularyTrees(vocab)[field], value)) {
    return { error: "Choose a value." };
  }
  if (list && value === null) return { error: "Choose a value." };
  const objectIds = ids.filter((id) => ObjectId.isValid(id));
  if (objectIds.length === 0) return { error: "Tick some garments." };

  const change =
    op === "set"
      ? {
          $set: {
            [field]: value,
            ...(field === "model" &&
              value && { category: vocab.models[value].suggestedCategory }),
          },
        }
      : op === "add"
        ? { $addToSet: { [field]: value } }
        : { $pull: { [field]: value } };
  const result = await garments.updateMany(
    { _id: { $in: objectIds.map((id) => new ObjectId(id)) } },
    {
      ...change,
      $currentDate: { updatedAt: true, "ingest.humanReviewedAt": true },
    },
  );
  updateTag("garments");
  return { changed: result.modifiedCount };
}
