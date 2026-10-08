// The archive grid at /garments: every published garment as a card, newest
// first, loading more as the visitor scrolls. The first page is part of the
// static page; the rest arrive through the `loadMoreGarments` action. Sorting
// and the list view come in the next chunk.
import { Container } from "@/components/container";
import { GarmentFeed } from "@/components/garment-feed";
import { getGarmentCards } from "@/lib/garments";
import { loadMoreGarments } from "./actions";

export default async function GarmentsPage() {
  const { cards, hasMore } = await getGarmentCards(1);
  return (
    <Container className="pt-10">
      <p className="eyebrow">Archive</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        All garments
      </h1>
      <GarmentFeed
        initialCards={cards}
        initialHasMore={hasMore}
        loadMore={loadMoreGarments}
      />
    </Container>
  );
}
