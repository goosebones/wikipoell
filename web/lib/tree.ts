// Helpers for the tree vocabularies (categories, colors, materials, extras),
// whose ids are dot paths like "black.010.010b". Pure functions with no
// database access, so client components can use them too.
import type { TreeNode } from "@/types";

type Tree = Record<string, TreeNode>;

// A regular expression matching a node's id and the ids of everything beneath
// it, for Mongo queries: `{ color: { $in: ["black.010"].map(subtree) } }`
// finds 010, 010B and 010T. The match stops at a dot boundary, so "black.01"
// does not match "black.010". Ids can come from the URL, so they are escaped.
export function subtree(id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(\\.|$)`);
}

// The node and its ancestors, root first:
// ancestors(colors, "black.010.010b") → [Black, 010, 010B].
export function ancestors(tree: Tree, id: string) {
  const path: TreeNode[] = [];
  for (let node = tree[id]; node; node = tree[node.parent ?? ""]) {
    path.unshift(node);
  }
  return path;
}

// How a single node reads on screen: "010 – Black (Leather)" for a node with
// a CCP code, just "Black" for a family or group. Some codes have no better
// label than the code itself (e.g. "SILVER"); those show once.
export function nodeLabel(node: TreeNode) {
  return node.code && node.code !== node.label
    ? `${node.code} – ${node.label}`
    : node.label;
}

// Sorts sibling nodes by code (falling back to the label), comparing numbers
// as numbers: "04" < "20", "010" < "101" < "1010".
export function byCode(a: TreeNode, b: TreeNode) {
  return (a.code ?? a.label).localeCompare(b.code ?? b.label, "en", {
    numeric: true,
  });
}

// The node id for a page's path segments, the reverse of nodeHref:
// pathToId(["black", "010"]) → "black.010".
export function pathToId(path: string[]) {
  return path.map(decodeURIComponent).join(".");
}

// The page for a node: nodeHref("/color", "black.010") → "/color/black/010".
export function nodeHref(base: string, id: string) {
  return `${base}/${id.replaceAll(".", "/")}`;
}

// The full readable path of a node, root first:
// labelPath(colors, "black.010") → ["Black", "010 – Black (Leather)"].
export function labelPath(tree: Tree, id: string) {
  return ancestors(tree, id).map(nodeLabel);
}

// Turns exact per-node counts into totals that include everything beneath:
// a garment counted on "black.010.010b" also counts for "black.010" and
// "black".
export function rollUp(tree: Tree, counts: Record<string, number>) {
  const totals: Record<string, number> = {};
  for (const [id, n] of Object.entries(counts)) {
    for (const node of ancestors(tree, id)) {
      totals[node._id] = (totals[node._id] ?? 0) + n;
    }
  }
  return totals;
}

// The nodes to show for a filter query: those whose label matches, with
// their ancestors (so a match keeps its place in the tree) and everything
// beneath them (so "black" shows the whole Black family). `nodes` is the
// part of the tree on offer. Null when the query is empty, meaning show all.
export function filterTree(tree: Tree, nodes: TreeNode[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const visible = new Set<string>();
  for (const n of nodes) {
    if (!nodeLabel(n).toLowerCase().includes(q)) continue;
    ancestors(tree, n._id).forEach((a) => visible.add(a._id));
    nodes
      .filter((d) => d._id.startsWith(`${n._id}.`))
      .forEach((d) => visible.add(d._id));
  }
  return visible;
}

// The slug suggested for a new node from its code (SCHEMA.md, "Slugs"):
// lowercase, `*` spelled out as `star` (with a count when repeated), and any
// other run of symbols or spaces as one `-`.
// slugFromCode("19**") → "19-star2", slugFromCode("X=NIT") → "x-nit".
export function slugFromCode(code: string) {
  return code
    .toLowerCase()
    .replace(/\*+/g, (stars) =>
      stars.length > 1 ? `-star${stars.length}` : "-star",
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
