// Grid filters, kept in the URL as comma-separated ids per field, e.g.
// ?type=a&procedure=r,in. Within a field any listed value matches; across
// fields all must match. Pure apart from the Mongo filter shape, so pages,
// server actions and the query all agree on one format.
export const FILTER_FIELDS = [
  "model",
  "type",
  "gender",
  "procedure",
  "process",
] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];
export type Filters = Partial<Record<FilterField, string[]>>;

// Ids are slugs (or model numbers), so anything else is dropped.
const ID = /^[a-z0-9-]+$/;

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
    Object.entries(filters).map(([field, values]) => [field, { $in: values }]),
  );
}
