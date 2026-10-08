// A category's page at /category/[...path] (e.g. /category/footwear/boots):
// a breadcrumb, the category's name and garment count, links to its
// subcategories, and every published garment in it or beneath it, with the
// usual sort, view and endless scrolling. Unknown categories get the 404 page.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { GarmentBrowser } from "@/components/garment-browser";
import { countGarments } from "@/lib/garments";
import { ancestors, nodeHref } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

export default function CategoryPage({
  params,
  searchParams,
}: PageProps<"/category/[...path]">) {
  return (
    <Container className="pt-10">
      {/* The category comes from the URL, so it is only known per request. */}
      <Suspense>
        <Category
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </Container>
  );
}

async function Category({
  params,
  searchParams,
}: PageProps<"/category/[...path]">) {
  const { path } = await params;
  const id = path.map(decodeURIComponent).join(".");
  const vocab = await getVocabulary();
  const category = vocab.categories[id];
  if (!category) notFound();

  const scope = { field: "category", id } as const;
  const count = await countGarments(scope);
  const subcategories = Object.values(vocab.categories)
    .filter((c) => c.parent === id)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Categories", href: "/category" },
          ...ancestors(vocab.categories, id).map((c) => ({
            label: c.label,
            href: nodeHref("/category", c._id),
          })),
        ]}
      />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {category.label}
      </h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {count.toLocaleString("en")} garments
      </p>

      {subcategories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {subcategories.map((c) => (
            <Link
              key={c._id}
              href={nodeHref("/category", c._id)}
              className="rounded-full border px-3 py-1 text-[13px] hover:bg-muted"
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}

      <GarmentBrowser
        searchParams={searchParams}
        scope={scope}
        basePath={nodeHref("/category", id)}
      />
    </>
  );
}
