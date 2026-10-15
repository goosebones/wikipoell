// Admin editing of a garment's fields: the title override and every
// vocabulary field. An edit is checked against the vocabulary before it's
// saved (the database only checks shapes), and saving marks the garment as
// human-reviewed so the ingest pipeline leaves its fields alone from then on.
// Saving calls updateTag, so it runs from a server action.
import { ObjectId } from "mongodb";
import { updateTag } from "next/cache";
import { garments } from "@/lib/db";
import { getVocabulary, vocabularyTrees } from "@/lib/vocabulary";

// In article-code order, then what the code leaves out.
export const EDIT_FIELDS = [
  "type",
  "gender",
  "model",
  "procedure",
  "material",
  "process",
  "color",
  "category",
  "extras",
] as const;
export type EditField = (typeof EDIT_FIELDS)[number];

// The fields that hold several values; the rest hold one or none.
export const LIST_FIELDS = new Set<EditField>([
  "procedure",
  "process",
  "extras",
]);

// Each field's value as a list of ids (empty for none), plus the title
// override (null to use the model's name).
export type GarmentEdit = Record<EditField, string[]> & {
  overrideTitle: string | null;
};

const byField = (value: (field: EditField) => string[]) =>
  Object.fromEntries(EDIT_FIELDS.map((f) => [f, value(f)])) as Record<
    EditField,
    string[]
  >;

// A garment and its current values in edit form; any status, so pending
// garments can be edited too. Null if the id doesn't exist.
export async function getGarmentEdit(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const garment = await garments.findOne({ _id: new ObjectId(id) });
  if (!garment) return null;
  const edit: GarmentEdit = {
    ...byField((field) => [garment[field] ?? []].flat()),
    overrideTitle: garment.overrideTitle,
  };
  return { garment, edit };
}

// An edit sent from the browser, checked against the vocabulary: every id
// must exist, none twice, and single-value fields hold at most one. Null if
// anything is off.
export async function checkEdit(input: unknown): Promise<GarmentEdit | null> {
  const trees = vocabularyTrees(await getVocabulary());
  const raw = (input ?? {}) as Record<string, unknown>;
  const valid = (field: EditField) => {
    const ids = raw[field];
    return (
      Array.isArray(ids) &&
      ids.every(
        (id) => typeof id === "string" && Object.hasOwn(trees[field], id),
      ) &&
      new Set(ids).size === ids.length &&
      (LIST_FIELDS.has(field) || ids.length <= 1)
    );
  };
  if (!EDIT_FIELDS.every(valid)) return null;
  const title =
    typeof raw.overrideTitle === "string" ? raw.overrideTitle.trim() : "";
  return {
    ...byField((field) => raw[field] as string[]),
    overrideTitle: title.slice(0, 200) || null,
  };
}

// Saves a checked edit and refreshes every cached page that shows garments.
export async function saveGarmentEdit(id: string, edit: GarmentEdit) {
  const now = new Date();
  await garments.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...Object.fromEntries(
          EDIT_FIELDS.map((f) => [
            f,
            LIST_FIELDS.has(f) ? edit[f] : (edit[f][0] ?? null),
          ]),
        ),
        overrideTitle: edit.overrideTitle,
        updatedAt: now,
        "ingest.humanReviewedAt": now,
      },
    },
  );
  updateTag("garments");
}
