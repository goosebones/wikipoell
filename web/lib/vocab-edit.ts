// Editing the vocabulary: adding, renaming, moving and deleting entries in
// any of the nine collections. Ids follow SCHEMA.md: flat values are a slug
// of their code, models are their number, and tree nodes are their parent's
// id plus a slug of their code (or name; categories stay camelCase). A
// rename never changes an id; a move does, so it rewrites the node and
// everything beneath it, and every garment, model and suggestion pointing at
// them, in one transaction. Only unused entries can be deleted. Changes call
// updateTag, so they run from server actions.
import { updateTag } from "next/cache";
import * as db from "@/lib/db";
import { slugFromCode } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

// Each collection: its title, the garment field that uses it, whether it's a
// tree, and whether its entries have CCP codes. (Models are their own case:
// the number is the id, and each has a suggested category.)
export const VOCABULARIES = {
  types: { title: "Types", field: "type", tree: false, codes: true },
  genders: { title: "Genders", field: "gender", tree: false, codes: true },
  procedures: {
    title: "Procedures",
    field: "procedure",
    tree: false,
    codes: true,
  },
  processes: { title: "Processes", field: "process", tree: false, codes: true },
  models: { title: "Models", field: "model", tree: false, codes: false },
  categories: {
    title: "Categories",
    field: "category",
    tree: true,
    codes: false,
  },
  colors: { title: "Colors", field: "color", tree: true, codes: true },
  materials: { title: "Materials", field: "material", tree: true, codes: true },
  extras: { title: "Extras", field: "extras", tree: true, codes: false },
} as const;
export type VocabName = keyof typeof VOCABULARIES;

// The collection behind a vocabulary. Tree collections (categories included,
// which store `name` for `label` but are otherwise alike) share one shape,
// and so do flat ones, so one handle type serves each kind.
const treeCollection = (name: VocabName) =>
  db[name] as unknown as typeof db.colors;
const flatCollection = (name: VocabName) =>
  db[name] as unknown as typeof db.types;

export function isVocabName(value: unknown): value is VocabName {
  return typeof value === "string" && Object.hasOwn(VOCABULARIES, value);
}

// One entry as the editor shows it. `code` is a model's number; `category`
// is a model's suggested category. `count` is how many garments (of any
// status) use it, and `deletable` says nothing uses it at all.
export type VocabEntry = {
  id: string;
  code: string | null;
  label: string;
  parent: string | null;
  category: string | null;
  count: number;
  deletable: boolean;
};

// The input for adding or changing an entry; parts a collection doesn't
// have are ignored.
export type EntryInput = {
  code: string;
  label: string;
  parent: string | null;
  category: string | null;
};

// What a change did: the new id (for an add or move), or why it didn't
// happen.
type Result = { id?: string; error?: string };

// How many documents use each value of a field: garments by default, or
// models (for suggested categories).
async function usage(
  field: string,
  collection: typeof db.garments | typeof db.models = db.garments,
) {
  const rows = await (collection as typeof db.garments)
    .aggregate<{ _id: string; n: number }>([
      { $unwind: `$${field}` },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

// Every entry of a collection, for the editor.
export async function getVocabEntries(name: VocabName): Promise<VocabEntry[]> {
  const [vocab, counts, modelUse] = await Promise.all([
    getVocabulary(),
    usage(VOCABULARIES[name].field),
    usage("suggestedCategory", db.models as unknown as typeof db.garments),
  ]);
  const docs = Object.values(vocab[name]) as {
    _id: string;
    label: string | null;
    code?: string | null;
    parent?: string | null;
    suggestedCategory?: string;
  }[];
  const parents = new Set(docs.map((d) => d.parent));
  return docs.map((d) => {
    const count = counts.get(d._id) ?? 0;
    const usedByModels = name === "categories" && modelUse.has(d._id);
    return {
      id: d._id,
      code: name === "models" ? d._id : (d.code ?? null),
      label: d.label ?? "",
      parent: d.parent ?? null,
      category: d.suggestedCategory ?? null,
      count,
      deletable: count === 0 && !parents.has(d._id) && !usedByModels,
    };
  });
}

// A new category's id segment: its name in camelCase, like the existing ones
// ("Long Sleeve Shirts" → "longSleeveShirts").
const camelSlug = (label: string) =>
  label
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");

export async function addEntry(
  name: VocabName,
  input: EntryInput,
): Promise<Result> {
  const { tree, codes } = VOCABULARIES[name];
  const vocab = await getVocabulary();
  const entries = vocab[name] as Record<string, { code?: string | null }>;
  const label = input.label.trim();
  const code = input.code.trim().toUpperCase();
  // Flat values may go without a name (the code is enough); others need one.
  if (!label && (tree || name === "models")) {
    return { error: "Give it a name." };
  }

  if (name === "models") {
    if (!/^[0-9]+$/.test(code)) return { error: "The number must be digits." };
    if (entries[code]) return { error: `Model ${code} already exists.` };
    if (!input.category || !vocab.categories[input.category]) {
      return { error: "Choose a category." };
    }
    await db.models.insertOne({
      _id: code,
      label,
      suggestedCategory: input.category,
    });
    updateTag("vocabulary");
    return { id: code };
  }

  if (codes && !tree && !code) return { error: "Give it a code." };
  if (codes && code && Object.values(entries).some((e) => e.code === code)) {
    return { error: `The code ${code} is already used.` };
  }
  if (tree && input.parent && !entries[input.parent]) {
    return { error: "Choose where it goes." };
  }
  const slug =
    name === "categories"
      ? camelSlug(label)
      : slugFromCode((codes && code) || label);
  if (!slug) return { error: "The code or name needs a letter or digit." };
  const id = tree && input.parent ? `${input.parent}.${slug}` : slug;
  if (entries[id]) return { error: `${id} already exists.` };

  if (name === "categories") {
    await db.categories.insertOne({
      _id: id,
      name: label,
      parent: input.parent,
    });
  } else if (tree) {
    await treeCollection(name).insertOne({
      _id: id,
      label,
      parent: input.parent,
      ...(codes && { code: code || null }),
    });
  } else {
    await flatCollection(name).insertOne({
      _id: id,
      code,
      label: label || null,
    });
  }
  updateTag("vocabulary");
  return { id };
}

// Renames an entry: its name, its code (where it has one), and a model's
// suggested category. The id stays the same.
export async function updateEntry(
  name: VocabName,
  id: string,
  input: EntryInput,
): Promise<Result> {
  const { tree, codes } = VOCABULARIES[name];
  const vocab = await getVocabulary();
  const entries = vocab[name] as Record<string, { code?: string | null }>;
  if (!entries[id]) return { error: "It no longer exists." };
  const label = input.label.trim();
  const code = input.code.trim().toUpperCase();
  // Flat values may go without a name (the code is enough); others need one.
  if (!label && (tree || name === "models")) {
    return { error: "Give it a name." };
  }

  if (name === "models") {
    if (!input.category || !vocab.categories[input.category]) {
      return { error: "Choose a category." };
    }
    await db.models.updateOne(
      { _id: id },
      { $set: { label, suggestedCategory: input.category } },
    );
  } else if (name === "categories") {
    await db.categories.updateOne({ _id: id }, { $set: { name: label } });
  } else if (codes) {
    if (!tree && !code) return { error: "Give it a code." };
    if (
      code &&
      Object.entries(entries).some(([key, e]) => key !== id && e.code === code)
    ) {
      return { error: `The code ${code} is already used.` };
    }
    if (tree) {
      await treeCollection(name).updateOne(
        { _id: id },
        { $set: { label, code: code || null } },
      );
    } else {
      await flatCollection(name).updateOne(
        { _id: id },
        { $set: { label: label || null, code } },
      );
    }
  } else {
    await treeCollection(name).updateOne({ _id: id }, { $set: { label } });
  }
  updateTag("vocabulary");
  return {};
}

// Moves a tree node (and everything beneath it) under a new parent, or to
// the top level with null. Its ids change, so every reference follows.
export async function moveEntry(
  name: VocabName,
  id: string,
  parent: string | null,
): Promise<Result> {
  const { tree, field } = VOCABULARIES[name];
  const vocab = await getVocabulary();
  const nodes = vocab[name] as Record<string, { parent?: string | null }>;
  if (!tree || !nodes[id]) return { error: "It no longer exists." };
  if (parent && !nodes[parent]) return { error: "Choose where it goes." };
  if (parent === id || parent?.startsWith(`${id}.`)) {
    return { error: "It can’t go under itself." };
  }
  if ((nodes[id].parent ?? null) === parent) return { id };

  const newBase = `${parent ? `${parent}.` : ""}${id.split(".").pop()}`;
  if (nodes[newBase]) return { error: `${newBase} already exists.` };
  // Old id → new id, for the node and everything beneath it.
  const renamed = new Map(
    Object.keys(nodes)
      .filter((key) => key === id || key.startsWith(`${id}.`))
      .map((key) => [key, newBase + key.slice(id.length)]),
  );
  const oldIds = [...renamed.keys()];

  const collection = treeCollection(name);
  await db.withTransaction(async (session) => {
    const docs = await collection
      .find({ _id: { $in: oldIds } }, { session })
      .toArray();
    await collection.deleteMany({ _id: { $in: oldIds } }, { session });
    await collection.insertMany(
      docs.map((d) => ({
        ...d,
        _id: renamed.get(d._id)!,
        parent:
          d._id === id
            ? parent
            : d.parent && (renamed.get(d.parent) ?? d.parent),
      })),
      { session },
    );
    for (const [from, to] of renamed) {
      await db.garments.updateMany(
        { [field]: from },
        field === "extras"
          ? { $set: { "extras.$[e]": to } }
          : { $set: { [field]: to } },
        {
          session,
          ...(field === "extras" && { arrayFilters: [{ e: from }] }),
        },
      );
      if (name === "categories") {
        await db.models.updateMany(
          { suggestedCategory: from },
          { $set: { suggestedCategory: to } },
          { session },
        );
      }
      await db.suggestions.updateMany(
        { "target.collection": name, "target.id": from },
        { $set: { "target.id": to } },
        { session },
      );
    }
  });
  updateTag("vocabulary");
  updateTag("garments");
  return { id: newBase };
}

// Deletes an entry that nothing uses: no garments, no children, and (for a
// category) no model suggesting it.
export async function deleteEntry(
  name: VocabName,
  id: string,
): Promise<Result> {
  const entry = (await getVocabEntries(name)).find((e) => e.id === id);
  if (!entry) return { error: "It no longer exists." };
  if (!entry.deletable) return { error: "It’s still in use." };
  await treeCollection(name).deleteOne({ _id: id });
  updateTag("vocabulary");
  return {};
}
