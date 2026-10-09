// A browsable garment listing: the filter panel beside (from desktop width
// up) the sort and grid/list controls and an endlessly scrolling feed. Used by
// every page that lists garments (the archive, and each category, color,
// material and model page). Reads the sort, view and filters from the URL, so
// it must sit inside <Suspense>.
// Props: searchParams (the page's), scope (what to list; null for the whole
// archive), basePath (the page's path, for the control links).
import Link from "next/link";
import { FilterPanel } from "@/components/filter-panel";
import { GarmentFeed } from "@/components/garment-feed";
import { GridControls, type View } from "@/components/grid-controls";
import {
  type Filters,
  hasFilters,
  parseFilters,
  setFilterParams,
} from "@/lib/filters";
import {
  countGarments,
  getFilterOptions,
  getGarmentCards,
  parseSort,
  type Scope,
  type Sort,
} from "@/lib/garments";
import { getVocabulary } from "@/lib/vocabulary";
import { loadMoreGarments } from "@/app/garments/actions";

export async function GarmentBrowser({
  searchParams,
  scope,
  basePath,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  scope: Scope;
  basePath: string;
}) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const view: View = params.view === "list" ? "list" : "grid";
  const filters = parseFilters(params);
  const filtered = hasFilters(filters);
  const [{ cards, hasMore }, options, vocab, count] = await Promise.all([
    getGarmentCards(1, sort, scope, filters),
    getFilterOptions(scope),
    getVocabulary(),
    filtered ? countGarments(scope, filters) : null,
  ]);

  // Defaults are left out of the URL, so the plain listing is just basePath.
  const href = (choice: { sort?: Sort; view?: View; filters?: Filters }) => {
    const query = new URLSearchParams();
    setFilterParams(query, choice.filters ?? filters);
    const s = choice.sort ?? sort;
    const v = choice.view ?? view;
    if (s !== "newest") query.set("sort", s);
    if (v !== "grid") query.set("view", v);
    // Commas need no escaping in a query, and read better as they are.
    const q = query.toString().replaceAll("%2C", ",");
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
      <aside className="mt-8 hidden lg:block">
        <FilterPanel
          options={options}
          filters={filters}
          vocab={vocab}
          href={(f) => href({ filters: f })}
          hide={scope?.field === "model" ? ["model"] : []}
        />
      </aside>
      <div className="min-w-0">
        <GridControls
          sort={sort}
          view={view}
          href={href}
        />
        {filtered && (
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {count!.toLocaleString("en")} matching ·{" "}
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
            loadMore={loadMoreGarments.bind(null, sort, scope, filters)}
            view={view}
          />
        )}
      </div>
    </div>
  );
}
