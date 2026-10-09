// A color's page at /color/[...path] (e.g. /color/black/010): everything in
// that color and beneath it. The layout is TreeListing.
import { Suspense } from "react";
import { Container } from "@/components/container";
import { TreeListing } from "@/components/tree-listing";

export default function ColorPage({
  params,
  searchParams,
}: PageProps<"/color/[...path]">) {
  return (
    <Container className="pt-10">
      {/* The color comes from the URL, so it is only known per request. */}
      <Suspense>
        <TreeListing
          params={params}
          searchParams={searchParams}
          field="color"
          base="/color"
          rootLabel="Colors"
        />
      </Suspense>
    </Container>
  );
}
