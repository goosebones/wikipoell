// Server actions for the admin pages: publishing or rejecting a pending
// garment, accepting or dismissing a suggestion, adding, renaming, moving and
// deleting vocabulary entries (from the vocabulary editor, or while
// reviewing), bulk edits, and homepage backgrounds. Each refuses anyone who isn't an admin, and checks its
// input.
"use server";

import { ObjectId } from "mongodb";
import { isAdmin } from "@/lib/auth";
import {
  addBackground,
  removeBackground,
  setBackgroundActive,
} from "@/lib/backgrounds";
import { EDIT_FIELDS, type EditField } from "@/lib/garment-edit";
import { applyBulkEdit } from "@/lib/quality";
import { resolveSuggestion, setGarmentStatus } from "@/lib/review";
import {
  addEntry,
  deleteEntry,
  type EntryInput,
  isVocabName,
  moveEntry,
  updateEntry,
  VOCABULARIES,
} from "@/lib/vocab-edit";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const isId = (value: unknown): value is string =>
  typeof value === "string" && ObjectId.isValid(value);

// Null on success, or why it didn't happen.
export async function reviewGarment(id: unknown, publish: unknown) {
  if (!(await isAdmin()) || !isId(id)) return "Not allowed.";
  return setGarmentStatus(id, publish === true ? "published" : "rejected");
}

export async function settleSuggestion(id: unknown, accept: unknown) {
  if (!(await isAdmin()) || !isId(id)) return;
  await resolveSuggestion(id, accept === true ? "accepted" : "dismissed");
}

// Adds an entry to any vocabulary (used for adding a missing value while
// reviewing): the new id, or why it couldn't be added.
export async function addVocabEntry(name: unknown, input: unknown) {
  if (!(await isAdmin()) || !isVocabName(name)) {
    return { error: "Not allowed." };
  }
  return addEntry(name, entryInput(input));
}

// Renames an entry, then moves it if its parent changed: the entry's id
// afterwards, or why it didn't happen.
export async function changeVocabEntry(
  name: unknown,
  id: unknown,
  input: unknown,
) {
  if (!(await isAdmin()) || !isVocabName(name) || typeof id !== "string") {
    return { error: "Not allowed." };
  }
  const entry = entryInput(input);
  const renamed = await updateEntry(name, id, entry);
  if (renamed.error) return renamed;
  return VOCABULARIES[name].tree ? moveEntry(name, id, entry.parent) : { id };
}

export async function deleteVocabEntry(name: unknown, id: unknown) {
  if (!(await isAdmin()) || !isVocabName(name) || typeof id !== "string") {
    return { error: "Not allowed." };
  }
  return deleteEntry(name, id);
}

// Sets, clears, adds or removes one field's value on many garments: how many
// changed, or why nothing did.
export async function bulkEdit(
  ids: unknown,
  field: unknown,
  op: unknown,
  value: unknown,
) {
  if (!(await isAdmin())) return { error: "Not allowed." };
  if (
    !Array.isArray(ids) ||
    !EDIT_FIELDS.includes(field as EditField) ||
    (op !== "set" && op !== "add" && op !== "remove")
  ) {
    return { error: "Not allowed." };
  }
  return applyBulkEdit(
    ids.filter(isId),
    field as EditField,
    op,
    text(value) || null,
  );
}

// Records a background just uploaded to R2 (by /api/admin/backgrounds). Only
// URLs from the background bucket are accepted.
export async function addHomepageBackground(url: unknown) {
  const base = process.env.R2_BACKGROUND_PUBLIC_URL?.replace(/\/$/, "");
  if (!(await isAdmin()) || !base || !text(url).startsWith(`${base}/`)) return;
  await addBackground(text(url));
}

export async function setHomepageBackgroundActive(id: unknown, on: unknown) {
  if (!(await isAdmin()) || !isId(id)) return;
  await setBackgroundActive(id, on === true);
}

// Removes a background, and deletes its file from R2.
export async function removeHomepageBackground(id: unknown) {
  if (!(await isAdmin()) || !isId(id)) return;
  await removeBackground(id);
}

// An entry's fields as sent from the browser, as plain strings.
function entryInput(input: unknown): EntryInput {
  const v = (input ?? {}) as Record<string, unknown>;
  return {
    code: text(v.code),
    label: text(v.label),
    parent: text(v.parent) || null,
    category: text(v.category) || null,
  };
}
