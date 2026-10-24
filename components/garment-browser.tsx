// A browsable garment listing: the filter panel (beside the grid from desktop
// width up, in a sheet behind a "Filters" button below it), the sort and
// grid/list controls and an endlessly scrolling feed, plus a "Bulk edit
// these" link for admins on any narrowed grid. Used by every page that lists
// garments (the archive, and each category, color, material and model page).
// Reads the sort, view and filters from the URL, so it must sit inside
// <Suspense>.
// Props: searchParams (the page's), scope (the page's own filters, e.g.
// { color: ["black"] }; {} for the whole archive), basePath (the page's path,
// for the control links).
import Link from "next/link";
import { FilterPanel } from "@/components/filter-panel";
import { FilterSheet } from "@/components/filter-sheet";
import { GarmentFeed } from "@/components/garment-feed";
import { GridControls, type View } from "@/components/grid-controls";
import {
  filterHref,
  type Filters,
  hasFilters,
  parseFilters,
} from "@/lib/filters";
import {
  countGarments,
  getFilterSections,
  getGarmentCards,
  parseSort,
  type Sort,
} from "@/lib/garments";
import { loadMoreGarments } from "@/app/garments/actions";
import { isAdmin } from "@/lib/auth";

export async function GarmentBrowser({
  searchParams,
  scope,
  basePath,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  scope: Filters;
  basePath: string;
}) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const view: View = params.view === "list" ? "list" : "grid";
  const filters = parseFilters(params);
  const filtered = hasFilters(filters);
  // The page's own filters win over the visitor's on the same field.
  const all = { ...filters, ...scope };
  const [{ cards, hasMore }, sections, count, admin] = await Promise.all([
    getGarmentCards(1, sort, all),
    getFilterSections(scope, filters),
    countGarments(all),
    isAdmin(),
  ]);

  // Defaults are left out of the URL, so the plain listing is just basePath.
  const href = (choice: { sort?: Sort; view?: View; filters?: Filters }) => {
    const s = choice.sort ?? sort;
    const v = choice.view ?? view;
    return filterHref(basePath, choice.filters ?? filters, {
      ...(s !== "newest" && { sort: s }),
      ...(v !== "grid" && { view: v }),
    });
  };

  const panel = (
    <FilterPanel
      sections={sections}
      filters={filters}
      href={(f) => href({ filters: f })}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
      <aside className="mt-8 hidden lg:block">{panel}</aside>
      <div className="min-w-0">
        <FilterSheet
          active={Object.values(filters).flat().length}
          count={count}
        >
          {panel}
        </FilterSheet>
        <GridControls
          sort={sort}
          view={view}
          href={href}
        />
        {/* Admins can bulk edit any narrowed grid, with the same filters. */}
        {admin && hasFilters(all) && (
          <Link
            href={filterHref("/admin/bulk", all)}
            className="eyebrow mt-3 inline-block hover:text-foreground"
          >
            Bulk edit these →
          </Link>
        )}
        {filtered && (
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {count.toLocaleString("en")} matching ·{" "}
            <Link
              href={href({ filters: {} })}
              scroll={false}
              className="hover:text-foreground hover:underline"
            >
              Clear filters
            </Link>
          </p>
        )}
        {count === 0 ? (
          <p className="mt-8 text-[13px] text-muted-foreground">
            No garments match these filters.
          </p>
        ) : (
          <GarmentFeed
            key={`${sort} ${JSON.stringify(filters)}`}
            initialCards={cards}
            initialHasMore={hasMore}
            loadMore={loadMoreGarments.bind(null, sort, all)}
            view={view}
          />
        )}
      </div>
    </div>
  );
}
