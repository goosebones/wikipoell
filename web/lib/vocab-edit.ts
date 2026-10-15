// Adding vocabulary entries: a model, or a material or color node. Used to
// add a missing value while reviewing a garment; the full vocabulary editor
// builds on it. New node ids follow SCHEMA.md: the parent's id plus a slug
// suggested from the code (or the name, for a node without a code). Each
// change refreshes the cached vocabulary with updateTag, so these run from
// server actions.
import { updateTag } from "next/cache";
import * as db from "@/lib/db";
import { slugFromCode } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

// The result of adding: the new entry's id, or why it couldn't be added.
type Added = { id: string } | { error: string };

export async function addModel(input: {
  number: string;
  label: string;
  category: string;
}): Promise<Added> {
  const vocab = await getVocabulary();
  const number = input.number.trim();
  const label = input.label.trim();
  if (!/^[0-9]+$/.test(number)) return { error: "The number must be digits." };
  if (!label) return { error: "Give the model a name." };
  if (!vocab.categories[input.category]) return { error: "Choose a category." };
  if (vocab.models[number]) return { error: `Model ${number} already exists.` };
  await db.models.insertOne({
    _id: number,
    label,
    suggestedCategory: input.category,
  });
  updateTag("vocabulary");
  return { id: number };
}

export async function addTreeNode(
  collection: "materials" | "colors",
  input: { code: string; label: string; parent: string | null },
): Promise<Added> {
  const vocab = await getVocabulary();
  const tree = vocab[collection];
  const code = input.code.trim().toUpperCase();
  const label = input.label.trim();
  if (!label) return { error: "Give it a name." };
  if (input.parent && !tree[input.parent]) {
    return { error: "Choose where it goes." };
  }
  const slug = slugFromCode(code || label);
  if (!slug) return { error: "The code or name needs a letter or digit." };
  const id = input.parent ? `${input.parent}.${slug}` : slug;
  if (tree[id]) return { error: `${id} already exists.` };
  if (code && Object.values(tree).some((n) => n.code === code)) {
    return { error: `The code ${code} is already used.` };
  }
  await db[collection].insertOne({
    _id: id,
    label,
    parent: input.parent,
    code: code || null,
  });
  updateTag("vocabulary");
  return { id };
}
