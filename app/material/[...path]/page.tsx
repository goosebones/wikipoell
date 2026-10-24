// A material's page at /material/[...path] (e.g. /material/leather/kangaroo/rooms): everything in
// that material and beneath it. The layout is TreeListing.
import { Suspense } from "react";
import { Container } from "@/components/container";
import { TreeListing } from "@/components/tree-listing";
import { nodeMetadata } from "@/lib/seo";
import { pathToId } from "@/lib/tree";

export async function generateMetadata({
  params,
}: PageProps<"/material/[...path]">) {
  return nodeMetadata("material", pathToId((await params).path));
}

export default function MaterialPage({
  params,
  searchParams,
}: PageProps<"/material/[...path]">) {
  return (
    <Container className="pt-10">
      {/* The material comes from the URL, so it is only known per request. */}
      <Suspense>
        <TreeListing
          params={params}
          searchParams={searchParams}
          field="material"
          base="/material"
          rootLabel="Materials"
        />
      </Suspense>
    </Container>
  );
}
