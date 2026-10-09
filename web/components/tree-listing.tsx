// The page for one node of a tree vocabulary (a category, color or material):
// a breadcrumb, a heading, the garment count, links to the nodes directly
// beneath it, and every published garment in it or beneath it, with the usual
// sort, view and endless scrolling. A node with a CCP code leads with the code
// ("ROOMS", with "Kangaroo" beneath it); a family or group shows its name.
// Unknown nodes get the 404 page. Reads the URL, so it must sit inside
// <Suspense>.
// Props: params (the route's, with the node's `path` segments), searchParams,
// field ("category" | "color" | "material"), base (the URL prefix, e.g.
// "/color"), rootLabel (the breadcrumb's first step, e.g. "Colors").
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { GarmentBrowser } from "@/components/garment-browser";
import { countGarments } from "@/lib/garments";
import { ancestors, nodeHref, nodeLabel } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

const TREES = {
  category: "categories",
  color: "colors",
  material: "materials",
} as const;

export async function TreeListing({
  params,
  searchParams,
  field,
  base,
  rootLabel,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  field: "category" | "color" | "material";
  base: string;
  rootLabel: string;
}) {
  const { path } = await params;
  const id = path.map(decodeURIComponent).join(".");
  const vocab = await getVocabulary();
  const tree = vocab[TREES[field]];
  const node = tree[id];
  if (!node) notFound();

  const scope = { field, id };
  const count = await countGarments(scope);
  const children = Object.values(tree)
    .filter((n) => n.parent === id)
    .sort((a, b) =>
      (a.code ?? a.label).localeCompare(b.code ?? b.label, "en", {
        numeric: true,
      }),
    );

  return (
    <>
      <Breadcrumb
        items={[
          { label: rootLabel, href: base },
          ...ancestors(tree, id).map((n) => ({
            label: n.code ?? n.label,
            href: nodeHref(base, n._id),
          })),
        ]}
      />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {node.code ?? node.label}
      </h1>
      {node.code && node.label !== node.code && (
        <p className="mt-1 text-[15px] text-muted-foreground">{node.label}</p>
      )}
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {count.toLocaleString("en")} garments
      </p>

      {children.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {children.map((n) => (
            <Link
              key={n._id}
              href={nodeHref(base, n._id)}
              className="rounded-full border px-3 py-1 text-[13px] hover:bg-muted"
            >
              {nodeLabel(n)}
            </Link>
          ))}
        </div>
      )}

      <GarmentBrowser
        searchParams={searchParams}
        scope={scope}
        basePath={nodeHref(base, id)}
      />
    </>
  );
}
