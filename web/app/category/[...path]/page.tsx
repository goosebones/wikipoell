// A category's page at /category/[...path] (e.g. /category/footwear/boots):
// everything in that category and beneath it. The layout is TreeListing.
import { Suspense } from "react";
import { Container } from "@/components/container";
import { TreeListing } from "@/components/tree-listing";
import { nodeMetadata } from "@/lib/seo";
import { pathToId } from "@/lib/tree";

export async function generateMetadata({
  params,
}: PageProps<"/category/[...path]">) {
  return nodeMetadata("category", pathToId((await params).path));
}

export default function CategoryPage({
  params,
  searchParams,
}: PageProps<"/category/[...path]">) {
  return (
    <Container className="pt-10">
      {/* The category comes from the URL, so it is only known per request. */}
      <Suspense>
        <TreeListing
          params={params}
          searchParams={searchParams}
          field="category"
          base="/category"
          rootLabel="Categories"
        />
      </Suspense>
    </Container>
  );
}
