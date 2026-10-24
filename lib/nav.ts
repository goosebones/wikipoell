// Builds the contents of the header's browse menus (category, model, color,
// material) from the vocabulary: plain lists of labels and links, small
// enough to send to the browser on every page.
import { nodeHref } from "@/lib/tree";
import type { Vocabulary } from "@/lib/vocabulary";
import type { TreeNode } from "@/types";

export type NavLink = { label: string; href: string };
export type NavGroup = NavLink & { children: NavLink[] };

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label, "en", { numeric: true });

// Top-level nodes of a tree, each with the next level down. With
// `subgroupsOnly` (materials), a group that has subgroups (Leather › Kangaroo,
// Horse…) lists only those, leaving the codes directly under it for its page;
// a group without subgroups lists its codes (Metal › SILVER).
function groups(
  tree: Record<string, TreeNode>,
  base: string,
  { subgroupsOnly = false, childLabel = (n: TreeNode) => n.label } = {},
): NavGroup[] {
  const nodes = Object.values(tree);
  const childrenOf = (id: string) => nodes.filter((n) => n.parent === id);
  return nodes
    .filter((n) => !n.parent)
    .map((root) => {
      const kids = childrenOf(root._id);
      const subgroups = subgroupsOnly
        ? kids.filter((k) => childrenOf(k._id).length > 0)
        : [];
      return {
        label: root.label,
        href: nodeHref(base, root._id),
        children: (subgroups.length ? subgroups : kids)
          .map((k) => ({ label: childLabel(k), href: nodeHref(base, k._id) }))
          .sort(byLabel),
      };
    })
    .sort(byLabel);
}

export function browseMenus(vocab: Vocabulary) {
  return {
    categories: groups(vocab.categories, "/category"),
    colors: groups(vocab.colors, "/color", {
      childLabel: (n) => n.code ?? n.label,
    }),
    materials: groups(vocab.materials, "/material", { subgroupsOnly: true }),
    models: Object.values(vocab.models)
      .map((m) => ({ label: `${m._id} – ${m.label}`, href: `/model/${m._id}` }))
      .sort(byLabel),
  };
}

export type BrowseMenus = ReturnType<typeof browseMenus>;
