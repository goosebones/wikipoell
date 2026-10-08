// A browsable garment listing: the sort and grid/list controls above an
// endlessly scrolling feed. Used by every page that lists garments (the
// archive, and each category, color, material and model page). Reads the sort
// and view from the URL, so it must sit inside <Suspense>.
// Props: searchParams (the page's), scope (what to list; null for the whole
// archive), basePath (the page's path, for the control links).
import { GarmentFeed } from "@/components/garment-feed";
import { GridControls, type View } from "@/components/grid-controls";
import {
  getGarmentCards,
  parseSort,
  type Scope,
  type Sort,
} from "@/lib/garments";
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
  const { cards, hasMore } = await getGarmentCards(1, sort, scope);

  // Defaults are left out of the URL, so the plain listing is just basePath.
  const href = (choice: { sort: Sort; view: View }) => {
    const query = new URLSearchParams();
    if (choice.sort !== "newest") query.set("sort", choice.sort);
    if (choice.view !== "grid") query.set("view", choice.view);
    const q = query.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <>
      <GridControls
        sort={sort}
        view={view}
        href={href}
      />
      <GarmentFeed
        key={sort}
        initialCards={cards}
        initialHasMore={hasMore}
        loadMore={loadMoreGarments.bind(null, sort, scope)}
        view={view}
      />
    </>
  );
}
