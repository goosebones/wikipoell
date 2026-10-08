// The row above a garment grid: sort options on the left (Newest, Model,
// Title) and the grid/list switch on the right, as plain links so they work
// without JavaScript. The active choice is dark, the others muted.
// Props: sort, view (the current choices), href (builds the URL for a given
// sort and view, so the page keeps its other URL parameters).
import Link from "next/link";
import { SORTS, type Sort } from "@/lib/garments";
import { cn } from "@/lib/utils";

export type View = "grid" | "list";

export function GridControls({
  sort,
  view,
  href,
}: {
  sort: Sort;
  view: View;
  href: (choice: { sort: Sort; view: View }) => string;
}) {
  const option = (active: boolean) =>
    cn("hover:text-foreground", active && "text-foreground");
  return (
    <div className="eyebrow mt-8 flex items-center gap-5">
      <span className="hidden sm:inline">Sort</span>
      {(Object.keys(SORTS) as Sort[]).map((s) => (
        <Link
          key={s}
          href={href({ sort: s, view })}
          className={option(s === sort)}
        >
          {SORTS[s]}
        </Link>
      ))}
      <span className="flex-1" />
      {/* Switching views keeps the loaded garments and the scroll position. */}
      {(["grid", "list"] as const).map((v) => (
        <Link
          key={v}
          href={href({ sort, view: v })}
          scroll={false}
          className={option(v === view)}
        >
          {v}
        </Link>
      ))}
    </div>
  );
}
