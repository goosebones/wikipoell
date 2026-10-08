// The archive at /garments: every published garment, loading more as the
// visitor scrolls. Sort (?sort=model|title, newest by default) and view
// (?view=list, grid by default) live in the URL, so any view can be linked.
// The first page of each sort is cached; the rest arrive through the
// `loadMoreGarments` action.
import { Suspense } from "react";
import { Container } from "@/components/container";
import { GarmentFeed } from "@/components/garment-feed";
import { GridControls, type View } from "@/components/grid-controls";
import { getGarmentCards, parseSort, type Sort } from "@/lib/garments";
import { loadMoreGarments } from "./actions";

export default function GarmentsPage({ searchParams }: PageProps<"/garments">) {
  return (
    <Container className="pt-10">
      <p className="eyebrow">Archive</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        All garments
      </h1>
      {/* Sort and view come from the URL, which is only known per request,
          so they are read inside the boundary. */}
      <Suspense>
        <Archive searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

// Defaults are left out of the URL, so the plain archive is just /garments.
function archiveHref({ sort, view }: { sort: Sort; view: View }) {
  const params = new URLSearchParams();
  if (sort !== "newest") params.set("sort", sort);
  if (view !== "grid") params.set("view", view);
  const query = params.toString();
  return query ? `/garments?${query}` : "/garments";
}

async function Archive({
  searchParams,
}: Pick<PageProps<"/garments">, "searchParams">) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const view: View = params.view === "list" ? "list" : "grid";
  const { cards, hasMore } = await getGarmentCards(1, sort);

  return (
    <>
      <GridControls
        sort={sort}
        view={view}
        href={archiveHref}
      />
      <GarmentFeed
        key={sort}
        initialCards={cards}
        initialHasMore={hasMore}
        loadMore={loadMoreGarments.bind(null, sort)}
        view={view}
      />
    </>
  );
}
