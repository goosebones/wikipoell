// Server actions for the admin review queue: publishing or rejecting a
// pending garment, accepting or dismissing a suggestion, and adding a missing
// model, material or color while reviewing. Each refuses anyone who isn't an
// admin, and checks its input.
"use server";

import { ObjectId } from "mongodb";
import { isAdmin } from "@/lib/auth";
import { resolveSuggestion, setGarmentStatus } from "@/lib/review";
import { addModel, addTreeNode } from "@/lib/vocab-edit";

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

export async function createModel(input: unknown) {
  if (!(await isAdmin())) return { error: "Not allowed." };
  const v = (input ?? {}) as Record<string, unknown>;
  return addModel({
    number: text(v.number),
    label: text(v.label),
    category: text(v.category),
  });
}

export async function createTreeNode(collection: unknown, input: unknown) {
  if (!(await isAdmin())) return { error: "Not allowed." };
  if (collection !== "materials" && collection !== "colors") {
    return { error: "Not allowed." };
  }
  const v = (input ?? {}) as Record<string, unknown>;
  return addTreeNode(collection, {
    code: text(v.code),
    label: text(v.label),
    parent: text(v.parent) || null,
  });
}
