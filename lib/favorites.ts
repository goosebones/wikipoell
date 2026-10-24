// Favorites (the `userFavorites` collection): any published garment a user
// marks to keep, shown on their profile. Each user's favorites are cached
// under "favorites:<userId>", which every change refreshes; changes call
// updateTag, so they run from server actions.
import { ObjectId } from "mongodb";
import { cacheLife, cacheTag, updateTag } from "next/cache";
import { garments, userFavorites } from "@/lib/db";
import { toCard } from "@/lib/garments";
import { getVocabulary } from "@/lib/vocabulary";

export async function isFavorite(userId: string, garmentId: string) {
  const garment = new ObjectId(garmentId);
  return (
    (await userFavorites.countDocuments({ userId, garmentId: garment })) > 0
  );
}

// Adds or removes a favorite. Only published garments can be added.
export async function setFavorite(
  userId: string,
  garmentId: string,
  on: boolean,
) {
  const _id = new ObjectId(garmentId);
  if (on) {
    if (!(await garments.countDocuments({ _id, status: "published" }))) return;
    await userFavorites.updateOne(
      { userId, garmentId: _id },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  } else {
    await userFavorites.deleteOne({ userId, garmentId: _id });
  }
  updateTag(`favorites:${userId}`);
}

// A user's favorites as cards, newest first. Garments that have since been
// unpublished are left out.
export async function getFavoriteCards(userId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`favorites:${userId}`, "garments");

  const favorites = await userFavorites
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  const [vocab, docs] = await Promise.all([
    getVocabulary(),
    garments
      .find({
        _id: { $in: favorites.map((f) => f.garmentId) },
        status: "published",
      })
      .toArray(),
  ]);
  const byId = new Map(docs.map((g) => [g._id.toString(), g]));
  return favorites.flatMap((f) => {
    const garment = byId.get(f.garmentId.toString());
    return garment ? [toCard(garment, vocab)] : [];
  });
}
