// Garment queries. Only published garments are ever shown to the public.
// Grids are fed plain card data (id, title, code, cover photo) rather than raw
// documents, which carry ObjectIds and so can't be cached or sent to the
// browser as they are.
import { cacheLife, cacheTag } from "next/cache";
import { garments } from "@/lib/db";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { getVocabulary } from "@/lib/vocabulary";

export const PER_PAGE = 48;

export type GarmentCardData = {
  id: string;
  title: string;
  code: readonly [string, string];
  image?: string;
};

// One page (from 1) of published garments for the archive grid, newest first,
// and whether more pages follow. Cached for an hour per page under the
// "garments" tag, so admin edits can refresh it.
export async function getGarmentCards(page: number) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");

  const [vocab, items] = await Promise.all([
    getVocabulary(),
    garments
      .find({ status: "published" })
      // `_id` breaks ties, so the order is identical from page to page.
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PER_PAGE)
      // One extra, only to learn whether another page exists.
      .limit(PER_PAGE + 1)
      .toArray(),
  ]);

  return {
    cards: items.slice(0, PER_PAGE).map((garment): GarmentCardData => ({
      id: garment._id.toString(),
      title: garmentTitle(garment, vocab),
      code: articleCode(garment, vocab),
      image: garment.images[0]?.url,
    })),
    hasMore: items.length > PER_PAGE,
  };
}
