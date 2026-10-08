// Helpers for the tree vocabularies (categories, colors, materials, extras),
// whose ids are dot paths like "black.010.010b". Pure functions with no
// database access, so client components can use them too.
import type { TreeNode } from "@/types";

type Tree = Record<string, TreeNode>;

// A Mongo filter value matching a node and everything beneath it, e.g.
// `garments.find({ color: subtree("black.010") })` finds 010, 010B and 010T.
// The match stops at a dot boundary, so "black.01" does not match
// "black.010". Ids can come from the URL, so they are escaped.
export function subtree(id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: `^${escaped}(\\.|$)` };
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

// The page for a node: nodeHref("/color", "black.010") → "/color/black/010".
export function nodeHref(base: string, id: string) {
  return `${base}/${id.replaceAll(".", "/")}`;
}

// The full readable path of a node, root first:
// labelPath(colors, "black.010") → ["Black", "010 – Black (Leather)"].
export function labelPath(tree: Tree, id: string) {
  return ancestors(tree, id).map(nodeLabel);
}
