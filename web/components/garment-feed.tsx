// An endlessly scrolling list of garments, shown as a grid of cards or as dense
// rows. Starts with the first page (rendered on the server) and fetches the
// next one whenever the visitor scrolls within about 800px of the bottom, until
// there are no more. When the visitor opens a garment and comes back, Next
// keeps this component alive, so the loaded garments and scroll position are
// still there. Give it a `key` that changes with the sort and filters, so a
// new sort or filter starts over from the top.
// Props: initialCards, initialHasMore (from the first page), loadMore (a server
// action returning `{ cards, hasMore }` for a page number), view ("grid" or
// "list").
"use client";

import { useEffect, useRef, useState } from "react";
import { GarmentCard } from "@/components/garment-card";
import { GarmentRow } from "@/components/garment-row";
import type { View } from "@/components/grid-controls";
import type { GarmentCardData } from "@/lib/garments";

type Page = { cards: GarmentCardData[]; hasMore: boolean };

export function GarmentFeed({
  initialCards,
  initialHasMore,
  loadMore,
  view,
}: {
  initialCards: GarmentCardData[];
  initialHasMore: boolean;
  loadMore: (page: number) => Promise<Page>;
  view: View;
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
        // any garment that is already shown.
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
      {view === "grid" ? (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
          {cards.map((card) => (
            <GarmentCard
              key={card.id}
              {...card}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 divide-y divide-muted border-y border-muted">
          {cards.map((card) => (
            <GarmentRow
              key={card.id}
              {...card}
            />
          ))}
        </div>
      )}
      <div ref={sentinel} />
    </>
  );
}
