// Loads every vocabulary collection (models, categories, colors, materials,
// extras, types, genders, procedures, processes) in one cached call, as maps
// keyed by id. Cached for up to 30 days under the "vocabulary" tag; anything
// that edits vocabulary calls `updateTag("vocabulary")` so the next read is
// fresh. Categories are reshaped into the same TreeNode form as colors and
// materials (`name` becomes `label`), so the tree helpers work on all of them.
import { cacheLife, cacheTag } from "next/cache";
import * as db from "@/lib/db";
import type { Model, Term, TreeNode } from "@/types";

export type Vocabulary = Awaited<ReturnType<typeof getVocabulary>>;

const byId = <T extends { _id: string }>(docs: T[]) =>
  Object.fromEntries(docs.map((d) => [d._id, d])) as Record<string, T>;

export async function getVocabulary() {
  "use cache";
  cacheLife("max");
  cacheTag("vocabulary");

  const [
    models,
    categories,
    colors,
    materials,
    extras,
    types,
    genders,
    procedures,
    processes,
  ] = await Promise.all([
    db.models.find().toArray(),
    db.categories.find().toArray(),
    db.colors.find().toArray(),
    db.materials.find().toArray(),
    db.extras.find().toArray(),
    db.types.find().toArray(),
    db.genders.find().toArray(),
    db.procedures.find().toArray(),
    db.processes.find().toArray(),
  ]);

  return {
    models: byId<Model>(models),
    categories: byId<TreeNode>(
      categories.map((c) => ({ _id: c._id, label: c.name, parent: c.parent })),
    ),
    colors: byId<TreeNode>(colors),
    materials: byId<TreeNode>(materials),
    extras: byId<TreeNode>(extras),
    types: byId<Term>(types),
    genders: byId<Term>(genders),
    procedures: byId<Term>(procedures),
    processes: byId<Term>(processes),
  };
}

// Every garment field's vocabulary as a tree, keyed by field, so pickers and
// filters can treat them all alike. Flat vocabularies (and models) become
// one-level trees whose nodes are labelled "code – name" by nodeLabel(), or
// just the code when there's no name.
export function vocabularyTrees(vocab: Vocabulary) {
  const flat = (
    docs: { _id: string; code?: string; label: string | null }[],
  ): Record<string, TreeNode> =>
    Object.fromEntries(
      docs.map((d) => {
        const code = d.code ?? d._id;
        return [
          d._id,
          { _id: d._id, code, label: d.label ?? code, parent: null },
        ];
      }),
    );
  return {
    category: vocab.categories,
    type: flat(Object.values(vocab.types)),
    gender: flat(Object.values(vocab.genders)),
    model: flat(Object.values(vocab.models)),
    procedure: flat(Object.values(vocab.procedures)),
    material: vocab.materials,
    process: flat(Object.values(vocab.processes)),
    color: vocab.colors,
    extras: vocab.extras,
  };
}

export type VocabularyTrees = ReturnType<typeof vocabularyTrees>;
