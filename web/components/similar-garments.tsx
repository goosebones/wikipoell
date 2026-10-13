// Similar garments below a garment page: a tab for each list (same piece,
// other colors, other materials, more of its category; they wrap onto a second
// line on narrow phones), and beneath them the chosen list as one row of
// smaller cards that scrolls sideways, on phones and desktop alike. A "See
// all" link beside the tabs leads to the filtered grid when the chosen list
// has more than the row shows.
// Props: sections (from getSimilarGarments()).
"use client";

import Link from "next/link";
import { useState } from "react";
import { GarmentCard } from "@/components/garment-card";
import type { getSimilarGarments } from "@/lib/garments";
import { cn } from "@/lib/utils";

export function SimilarGarments({
  sections,
}: {
  sections: Awaited<ReturnType<typeof getSimilarGarments>>;
}) {
  const [tab, setTab] = useState(0);
  const current = sections[tab];
  if (!current) return null;

  return (
    <section className="mt-16">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-wrap gap-2">
          {sections.map((section, i) => (
            <button
              key={section.title}
              onClick={() => setTab(i)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px]",
                i === tab
                  ? "border-foreground bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              {section.title}
            </button>
          ))}
        </div>
        {current.hasMore && (
          <Link
            href={current.href}
            className="eyebrow shrink-0 pt-1.5 hover:text-foreground"
          >
            See all →
          </Link>
        )}
      </div>
      <div className="-mx-4 mt-6 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {current.cards.map((card) => (
          <div
            key={card.id}
            className="w-36 shrink-0 snap-start sm:w-44"
          >
            <GarmentCard {...card} />
          </div>
        ))}
      </div>
    </section>
  );
}
