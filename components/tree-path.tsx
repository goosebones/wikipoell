// A tree value written out as its full path, each step linking to its own page:
// "Black › 010 – Black (Leather)". Used for categories, colors, materials and
// extras.
// Props: tree (the vocabulary map, e.g. vocab.colors), id (the node), base
// (the URL prefix for that tree, e.g. "/color").
import Link from "next/link";
import { ancestors, nodeHref, nodeLabel } from "@/lib/tree";
import type { TreeNode } from "@/types";

export function TreePath({
  tree,
  id,
  base,
}: {
  tree: Record<string, TreeNode>;
  id: string;
  base: string;
}) {
  return ancestors(tree, id).map((node, i) => (
    <span key={node._id}>
      {i > 0 && <span className="mx-1.5 text-muted-foreground">›</span>}
      <Link
        href={nodeHref(base, node._id)}
        className="hover:underline"
      >
        {nodeLabel(node)}
      </Link>
    </span>
  ));
}
