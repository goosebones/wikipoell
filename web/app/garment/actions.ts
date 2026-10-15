// Server actions for garment pages. `favoriteGarment` adds or removes a
// favorite for the signed-in user only, and returns whether the garment is a
// favorite afterwards, so the button shows what was saved (null if there's no
// signed-in user or the id is bad). `saveGarment` saves an admin's edit (and
// accepts the suggestion it applies, if any) and says whether it was saved.
"use server";

import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { isAdmin } from "@/lib/auth";
import { isFavorite, setFavorite } from "@/lib/favorites";
import { checkEdit, saveGarmentEdit } from "@/lib/garment-edit";
import { getGarmentSuggestion, resolveSuggestion } from "@/lib/review";

export async function favoriteGarment(garmentId: unknown, on: unknown) {
  // Anyone can call a server action, so the user and garment id are checked.
  const { userId } = await auth();
  if (
    !userId ||
    typeof garmentId !== "string" ||
    !ObjectId.isValid(garmentId)
  ) {
    return null;
  }
  await setFavorite(userId, garmentId, on === true);
  return isFavorite(userId, garmentId);
}

// With a suggestion id, the suggestion this edit applies is marked accepted.
export async function saveGarment(
  garmentId: unknown,
  edit: unknown,
  suggestionId?: unknown,
) {
  if (
    !(await isAdmin()) ||
    typeof garmentId !== "string" ||
    !ObjectId.isValid(garmentId)
  ) {
    return false;
  }
  const checked = await checkEdit(edit);
  if (!checked) return false;
  await saveGarmentEdit(garmentId, checked);
  if (typeof suggestionId === "string") {
    const suggestion = await getGarmentSuggestion(suggestionId, garmentId);
    if (suggestion) await resolveSuggestion(suggestion.id, "accepted");
  }
  return true;
}
