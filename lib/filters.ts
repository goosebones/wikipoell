// Grid filters, kept in the URL as comma-separated ids per field, e.g.
// ?type=a&procedure=r,in&color=black. Within a field any listed value
// matches; across fields all must match. A category, color or material
// matches that node and everything beneath it. One format shared by pages,
// server actions, the query and the filter panel.
import { ancestors, byCode, nodeLabel, rollUp, subtree } from "@/lib/tree";
import { type Vocabulary, vocabularyTrees } from "@/lib/vocabulary";

// In the filter panel's order: category, then the article code's order.
export const FILTER_FIELDS = [
  "category",
  "type",
  "gender",
  "model",
  "procedure",
  "material",
  "process",
  "color",
] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];
export type Filters = Partial<Record<FilterField, string[]>>;

const TREE_FIELDS = new Set<string>(["category", "color", "material"]);

// Ids are slugs, model numbers or dot paths (categories are camelCase), so
// anything else is dropped.
const ID = /^[A-Za-z0-9.-]+$/;

// Reads filters from URL search params, or from a filters object sent back
// by the browser through a server action. Values are sorted, so the same
// filters always produce the same cache key.
export function parseFilters(input: unknown): Filters {
  const source = (input ?? {}) as Record<string, unknown>;
  const filters: Filters = {};
  for (const field of FILTER_FIELDS) {
    // A URL gives "a,b" (or ["a", "b"] for a repeated param); a server
    // action gives back ["a", "b"].
    const values = [source[field]]
      .flat()
      .flatMap((v) => (typeof v === "string" ? v.split(",") : []))
      .filter((v) => ID.test(v));
    if (values.length) filters[field] = [...new Set(values)].sort();
  }
  return filters;
}

export function hasFilters(filters: Filters) {
  return Object.keys(filters).length > 0;
}

// The filters with one value switched on or off.
export function toggleFilter(
  filters: Filters,
  field: FilterField,
  value: string,
): Filters {
  const current = filters[field] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value].sort();
  const result = { ...filters, [field]: next };
  if (!next.length) delete result[field];
  return result;
}

// A garment grid's URL. The defaults (newest, grid) are left out, so the
// plain listing is just the base path.
export function gridHref(
  base: string,
  filters: Filters,
  sort: string,
  view: string,
) {
  return filterHref(base, filters, {
    ...(sort !== "newest" && { sort }),
    ...(view !== "grid" && { view }),
  });
}

// A page's URL with these filters and any other params:
// filterHref("/model/2600", { color: ["black.010"] }) → "/model/2600?color=black.010".
export function filterHref(
  base: string,
  filters: Filters,
  params: Record<string, string> = {},
) {
  const query = new URLSearchParams();
  for (const field of FILTER_FIELDS) {
    if (filters[field]?.length) query.set(field, filters[field].join(","));
  }
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  // Commas need no escaping in a query, and read better as they are.
  const q = query.toString().replaceAll("%2C", ",");
  return q ? `${base}?${q}` : base;
}

// The Mongo filter for these filters. Procedure and process are lists on a
// garment, and `$in` matches if any of them is selected.
export function filterQuery(filters: Filters) {
  return Object.fromEntries(
    Object.entries(filters).map(([field, values]) => [
      field,
      {
        $in: TREE_FIELDS.has(field) ? values.map(subtree) : values,
      },
    ]),
  );
}

// One choice in the filter panel, ready to draw: how many garments it would
// show, the URL that switches it on or off, whether it is on, whether
// something beneath it is on (so it starts open), and the choices beneath it.
export type FilterChoice = {
  id: string;
  label: string;
  count: number;
  href: string;
  active: boolean;
  open: boolean;
  children: FilterChoice[];
};

// One field's choices in the filter panel. `available` decides which values
// are offered (the field's values, plus their parents so trees stay whole, in
// code order); `counts` gives the number shown beside each, where a parent
// counts everything beneath it. Flat vocabularies become one-level trees, so
// the panel draws every field the same way. `href` builds a URL from the
// visitor's filters.
export function filterChoices(
  vocab: Vocabulary,
  field: FilterField,
  available: Record<string, number>,
  counts: Record<string, number>,
  filters: Filters,
  href: (filters: Filters) => string,
) {
  const tree = vocabularyTrees(vocab)[field];
  const nodes = new Set(
    Object.keys(available).flatMap((id) => ancestors(tree, id)),
  );
  const totals = rollUp(tree, counts);
  const on = filters[field] ?? [];
  const under = (parent: string | null): FilterChoice[] =>
    [...nodes]
      .filter((n) => n.parent === parent)
      .sort(byCode)
      .map((n) => ({
        id: n._id,
        label: nodeLabel(n),
        count: totals[n._id] ?? 0,
        href: href(toggleFilter(filters, field, n._id)),
        active: on.includes(n._id),
        open: on.some((id) => id.startsWith(`${n._id}.`)),
        children: under(n._id),
      }));
  return under(null);
}
