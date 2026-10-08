// An endlessly scrolling grid of garment cards. Starts with the first page
// (rendered on the server) and fetches the next one whenever the visitor
// scrolls within about 800px of the bottom, until there are no more. When the
// visitor opens a garment and comes back, Next keeps this component alive, so
// the loaded cards and scroll position are still there.
// Props: initialCards, initialHasMore (from the first page), loadMore (a server
// action returning `{ cards, hasMore }` for a page number).
"use client";

import { useEffect, useRef, useState } from "react";
import { GarmentCard } from "@/components/garment-card";
import type { GarmentCardData } from "@/lib/garments";

type Page = { cards: GarmentCardData[]; hasMore: boolean };

export function GarmentFeed({
  initialCards,
  initialHasMore,
  loadMore,
}: {
  initialCards: GarmentCardData[];
  initialHasMore: boolean;
  loadMore: (page: number) => Promise<Page>;
}) {
  const [cards, setCards] = useState(initialCards);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const page = useRef(1);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setLoading(true);
        const next = await loadMore(page.current + 1);
        page.current += 1;
        // A garment published mid-scroll shifts the pages by one, so skip
        // any card that is already shown.
        setCards((shown) => {
          const ids = new Set(shown.map((c) => c.id));
          return [...shown, ...next.cards.filter((c) => !ids.has(c.id))];
        });
        setHasMore(next.hasMore);
        setLoading(false);
      },
      { rootMargin: "800px" },
    );
    observer.observe(sentinel.current!);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
        {cards.map((card) => (
          <GarmentCard
            key={card.id}
            {...card}
          />
        ))}
      </div>
      <div ref={sentinel} />
    </>
  );
}
