// Server actions for garment pages. `favoriteGarment` adds or removes a
// favorite for the signed-in user only, and returns whether the garment is a
// favorite afterwards, so the button shows what was saved (null if there's no
// signed-in user or the id is bad).
"use server";

import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { isFavorite, setFavorite } from "@/lib/favorites";

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
