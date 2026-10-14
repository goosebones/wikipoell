// Garment cards in the site's grid: two columns on phones, three from tablet
// width and four on wide screens. Used by the endless feed and profiles.
// Props: cards (GarmentCardData[]), className (e.g. spacing above).
import { GarmentCard } from "@/components/garment-card";
import type { GarmentCardData } from "@/lib/garments";
import { cn } from "@/lib/utils";

export function CardGrid({
  cards,
  className,
}: {
  cards: GarmentCardData[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4",
        className,
      )}
    >
      {cards.map((card) => (
        <GarmentCard
          key={card.id}
          {...card}
        />
      ))}
    </div>
  );
}
