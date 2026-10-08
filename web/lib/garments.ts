// Garment queries. Only published garments are ever shown to the public.
// Callers cache the result themselves (a `"use cache"` component), because
// documents carry ObjectIds, which can't be cached as plain data.
import { garments } from "@/lib/db";

// The newest published garments, for the archive grid.
export async function getPublishedGarments(limit: number) {
  return garments
    .find({ status: "published" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
