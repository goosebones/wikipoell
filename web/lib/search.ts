// Site search. A query is matched against the archive's entities rather than
// garment titles: models (number and name), categories, materials and colors
// (code and label), and type, procedure and process codes. Each result leads
// to that entity's page, or to the archive filtered to it. A query that reads
// as an article code also offers to decode it. Only entities with garments
// are searchable. Everything is matched in memory against a cached index;
// the archive is small enough not to need a search service.
import { cacheLife, cacheTag } from "next/cache";
import { cleanArticleCode, decodeArticleCode } from "@/lib/article-code";
import { filterHref } from "@/lib/filters";
import { getCounts } from "@/lib/garments";
import { labelPath, nodeHref, rollUp } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";
import type { TreeNode } from "@/types";

export type SearchResult = {
  kind: string;
  code: string | null;
  label: string;
  href: string;
  count: number;
};

// Every searchable entity, with garment counts. Cached for an hour under
// both tags, so vocabulary and garment edits refresh it.
async function getSearchIndex() {
  "use cache";
  cacheLife("hours");
  cacheTag("vocabulary", "garments");

  const [
    vocab,
    models,
    categories,
    colors,
    materials,
    types,
    procedures,
    processes,
  ] = await Promise.all([
    getVocabulary(),
    getCounts("model"),
    getCounts("category"),
    getCounts("color"),
    getCounts("material"),
    getCounts("type"),
    getCounts("procedure"),
    getCounts("process"),
  ]);

  // A tree's nodes, each counting everything beneath it. Nodes without a code
  // read as their path ("Footwear › Boots", "Leather › Kangaroo"); coded ones
  // by their own name, next to the code.
  const tree = (
    kind: string,
    nodes: Record<string, TreeNode>,
    counts: Record<string, number>,
    base: string,
  ): SearchResult[] => {
    const totals = rollUp(nodes, counts);
    return Object.values(nodes).map((node) => ({
      kind,
      code: node.code && node.code !== node.label ? node.code : null,
      label: node.code ? node.label : labelPath(nodes, node._id).join(" › "),
      href: nodeHref(base, node._id),
      count: totals[node._id] ?? 0,
    }));
  };

  // A flat vocabulary's codes, each leading to the archive filtered to it.
  const terms = (
    kind: string,
    field: "type" | "procedure" | "process",
    entries: Record<
      string,
      { _id: string; code: string; label: string | null }
    >,
    counts: Record<string, number>,
  ): SearchResult[] =>
    Object.values(entries).map((term) => ({
      kind,
      code: term.code,
      label: term.label ?? "",
      href: filterHref("/garments", { [field]: [term._id] }),
      count: counts[term._id] ?? 0,
    }));

  return [
    ...Object.values(vocab.models).map((model) => ({
      kind: "Model",
      code: model._id,
      label: model.label,
      href: `/model/${model._id}`,
      count: models[model._id] ?? 0,
    })),
    ...tree("Category", vocab.categories, categories, "/category"),
    ...tree("Material", vocab.materials, materials, "/material"),
    ...tree("Color", vocab.colors, colors, "/color"),
    ...terms("Type", "type", vocab.types, types),
    ...terms("Procedure", "procedure", vocab.procedures, procedures),
    ...terms("Process", "process", vocab.processes, processes),
  ].filter((result) => result.count > 0);
}

// The best matches for a query, at most `limit`. Every word of the query must
// appear in the code or label. Exact codes rank first, then codes and labels
// that start with the query, then matches at the start of a word, then the
// rest; ties go to whatever has more garments.
export async function search(query: string, limit: number) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [index, vocab] = await Promise.all([getSearchIndex(), getVocabulary()]);
  const words = q.split(/\s+/);
  const rank = (result: SearchResult) => {
    const code = result.code?.toLowerCase() ?? "";
    const label = result.label.toLowerCase();
    if (code === q) return 0;
    if (code.startsWith(q) || label.startsWith(q)) return 1;
    if (` ${label}`.includes(` ${q}`)) return 2;
    return 3;
  };
  const matches = index
    .filter((result) => {
      const text = `${result.code ?? ""} ${result.label}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .map((result) => ({ result, rank: rank(result) }))
    .sort((a, b) => a.rank - b.rank || b.result.count - a.result.count)
    .map(({ result }) => result);

  // A full article code is offered for decoding, ahead of everything else.
  const code = decodeArticleCode(query, vocab) && cleanArticleCode(query);
  const decode: SearchResult[] = code
    ? [
        {
          kind: "Article code",
          code,
          label: "Decode this code",
          href: `/decode?code=${encodeURIComponent(code)}`,
          count: 0,
        },
      ]
    : [];
  return [...decode, ...matches].slice(0, limit);
}
