// Grid filters, kept in the URL as comma-separated ids per field, e.g.
// ?type=a&procedure=r,in&color=black. Within a field any listed value
// matches; across fields all must match. A category, color or material
// matches that node and everything beneath it. One format shared by pages,
// server actions, the query and the filter panel.
import { ancestors, byCode, nodeLabel, subtreePattern } from "@/lib/tree";
import type { Vocabulary } from "@/lib/vocabulary";
import type { TreeNode } from "@/types";

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
export function parseFilters(
  input: Record<string, string | string[] | undefined> | unknown,
): Filters {
  const source = (input ?? {}) as Record<string, unknown>;
  const filters: Filters = {};
  for (const field of FILTER_FIELDS) {
    const raw = ([] as unknown[]).concat(source[field] ?? []);
    const values = raw
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

// Writes filters into URL search params (comma-separated per field).
export function setFilterParams(params: URLSearchParams, filters: Filters) {
  for (const field of FILTER_FIELDS) {
    if (filters[field]?.length) params.set(field, filters[field].join(","));
  }
}

// The Mongo filter for these filters. Procedure and process are lists on a
// garment, and `$in` matches if any of them is selected.
export function filterQuery(filters: Filters) {
  return Object.fromEntries(
    Object.entries(filters).map(([field, values]) => [
      field,
      {
        $in: TREE_FIELDS.has(field) ? values.map(subtreePattern) : values,
      },
    ]),
  );
}

// One choice in the filter panel, with the choices nested beneath it.
export type FilterOption = {
  id: string;
  label: string;
  children: FilterOption[];
};

// The filter panel's contents: for each field given, its values as options,
// plus their parents so trees stay whole, in code order. Flat vocabularies
// become one-level trees, so the panel draws every field the same way.
// Fields without values are left out.
export function filterSections(
  vocab: Vocabulary,
  values: Partial<Record<FilterField, string[]>>,
) {
  const flat = (docs: { _id: string; code?: string; label: string | null }[]) =>
    Object.fromEntries(
      docs.map((d) => {
        const code = d.code ?? d._id;
        return [
          d._id,
          { _id: d._id, code, label: d.label ?? code, parent: null },
        ];
      }),
    );
  const trees: Record<FilterField, Record<string, TreeNode>> = {
    category: vocab.categories,
    type: flat(Object.values(vocab.types)),
    gender: flat(Object.values(vocab.genders)),
    model: flat(Object.values(vocab.models)),
    procedure: flat(Object.values(vocab.procedures)),
    material: vocab.materials,
    process: flat(Object.values(vocab.processes)),
    color: vocab.colors,
  };

  return FILTER_FIELDS.filter((field) => values[field]?.length).map((field) => {
    const tree = trees[field];
    const nodes = new Set(values[field]!.flatMap((id) => ancestors(tree, id)));
    const under = (parent: string | null): FilterOption[] =>
      [...nodes]
        .filter((n) => n.parent === parent)
        .sort(byCode)
        .map((n) => ({
          id: n._id,
          label: nodeLabel(n),
          children: under(n._id),
        }));
    return { field, options: under(null) };
  });
}
