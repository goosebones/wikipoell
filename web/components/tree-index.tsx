// An index of a whole tree vocabulary (categories, colors or materials): one
// section per top-level node, with everything beneath it nested and indented,
// each entry linking to its page and showing how many garments it covers
// (itself plus everything beneath). Entries with no garments are left out.
// A filter box at the top narrows the list as you type, matching codes and
// labels: a match stays visible along with its parents (so "rooms" shows
// Leather › Kangaroo › ROOMS) and everything beneath it (so "black" shows the
// whole Black family).
// Props: tree (the vocabulary map), totals (counts from rollUp()), base (the
// URL prefix, e.g. "/color"), noun (what to call the entries in the filter's
// placeholder, e.g. "colors").
"use client";

import Link from "next/link";
import { useState } from "react";
import { FilterInput } from "@/components/filter-input";
import { ancestors, byCode, nodeHref, nodeLabel } from "@/lib/tree";
import type { TreeNode } from "@/types";

type Tree = Record<string, TreeNode>;

export function TreeIndex({
  tree,
  totals,
  base,
  noun,
}: {
  tree: Tree;
  totals: Record<string, number>;
  base: string;
  noun: string;
}) {
  const [query, setQuery] = useState("");
  const nodes = Object.values(tree).filter((n) => totals[n._id]);

  // With a query: the matching nodes, their ancestors and their descendants.
  const q = query.trim().toLowerCase();
  const visible = new Set<string>();
  if (q) {
    for (const n of nodes) {
      if (!nodeLabel(n).toLowerCase().includes(q)) continue;
      ancestors(tree, n._id).forEach((a) => visible.add(a._id));
      nodes
        .filter((d) => d._id.startsWith(`${n._id}.`))
        .forEach((d) => visible.add(d._id));
    }
  }
  const shown = (n: TreeNode) => !q || visible.has(n._id);

  const childrenOf = (id: string | null) =>
    nodes.filter((n) => n.parent === id && shown(n)).sort(byCode);

  const entry = (node: TreeNode, depth: number): React.ReactNode => (
    <li key={node._id}>
      <Link
        href={nodeHref(base, node._id)}
        className="flex justify-between gap-4 py-0.5 text-[13px] text-muted-foreground hover:text-foreground"
        style={{ paddingLeft: `${(depth - 1) * 0.75}rem` }}
      >
        <span>{nodeLabel(node)}</span>
        <span className="font-mono text-[11px]">{totals[node._id]}</span>
      </Link>
      {childrenOf(node._id).length > 0 && (
        <ul>{childrenOf(node._id).map((c) => entry(c, depth + 1))}</ul>
      )}
    </li>
  );

  const roots = childrenOf(null);

  return (
    <>
      <div className="mt-6">
        <FilterInput
          value={query}
          onChange={setQuery}
          placeholder={`Filter ${noun}…`}
        />
      </div>
      {roots.length === 0 && (
        <p className="mt-8 text-[13px] text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      )}
      <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {roots.map((root) => (
          <section key={root._id}>
            <Link
              href={nodeHref(base, root._id)}
              className="flex justify-between gap-4 border-b border-muted pb-2 font-medium hover:underline"
            >
              <span>{nodeLabel(root)}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {totals[root._id]}
              </span>
            </Link>
            <ul className="mt-2">
              {childrenOf(root._id).map((c) => entry(c, 1))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
