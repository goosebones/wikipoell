// Suggested corrections (the `suggestions` collection). A signed-in user can
// suggest a change to a garment's fields, or to a model, category, material
// or color. The form offers the target's fields with what each shows now;
// the same list checks a submitted suggestion, and the server records the
// current value itself. Suggestions are free text and wait for an admin.
import { suggestions } from "@/lib/db";
import { garmentFields } from "@/lib/garment-display";
import { getGarment } from "@/lib/garments";
import { labelPath } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";
import type { Suggestion } from "@/types";

export type SuggestionTarget = Suggestion["target"];
export type SuggestionField = { field: string; label: string; current: string };

const COLLECTIONS: SuggestionTarget["collection"][] = [
  "garments",
  "models",
  "categories",
  "materials",
  "colors",
];

// A target sent from the browser, checked before use.
export function parseTarget(value: unknown): SuggestionTarget | null {
  const v = value as SuggestionTarget | null;
  return v && COLLECTIONS.includes(v.collection) && typeof v.id === "string"
    ? { collection: v.collection, id: v.id }
    : null;
}

// The fields a suggestion can be about, in the order the page shows them,
// each with its current value; null if the target doesn't exist. Every
// target ends with "Something else" for anything the list doesn't cover.
export async function getSuggestionFields(
  target: SuggestionTarget,
): Promise<SuggestionField[] | null> {
  const vocab = await getVocabulary();
  const other = { field: "other", label: "Something else", current: "" };

  if (target.collection === "garments") {
    const garment = await getGarment(target.id);
    if (!garment) return null;
    return [
      ...garmentFields(garment, vocab).map(({ field, label, value }) => ({
        field,
        label,
        current: value,
      })),
      other,
    ];
  }

  if (target.collection === "models") {
    const model = vocab.models[target.id];
    if (!model) return null;
    return [
      { field: "label", label: "Name", current: model.label },
      {
        field: "suggestedCategory",
        label: "Category",
        current: labelPath(vocab.categories, model.suggestedCategory).join(
          " › ",
        ),
      },
      other,
    ];
  }

  const tree = vocab[target.collection];
  const node = tree[target.id];
  if (!node) return null;
  return [
    { field: "label", label: "Name", current: node.label },
    ...(node.code
      ? [{ field: "code", label: "Code", current: node.code }]
      : []),
    {
      field: "parent",
      label: "Where it sits",
      current: node.parent
        ? labelPath(tree, node.parent).join(" › ")
        : "Top level",
    },
    other,
  ];
}

// Stores a suggestion, if the field is one the target offers. The current
// value comes from the target, never from the form.
export async function saveSuggestion(
  userId: string,
  target: SuggestionTarget,
  field: string,
  proposed: string,
  note: string,
) {
  const fields = await getSuggestionFields(target);
  const chosen = fields?.find((f) => f.field === field);
  if (!chosen) return false;
  await suggestions.insertOne({
    userId,
    target,
    field,
    current: chosen.current,
    proposed,
    note,
    status: "open",
    createdAt: new Date(),
  });
  return true;
}
