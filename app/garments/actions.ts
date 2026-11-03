// Server actions for garment grids. The browser calls `loadMoreGarments` as
// the visitor scrolls, to fetch the next page of cards in the grid's current
// sort and filters (the page's own and the visitor's together), and
// `loadFilterChoices` when the visitor opens a section of the filter panel.
"use server";

import { FILTER_FIELDS, parseFilters } from "@/lib/filters";
import { getFilterChoices, getGarmentCards, parseSort } from "@/lib/garments";

export async function loadMoreGarments(
  sort: string,
  filters: unknown,
  page: number,
) {
  // Anyone can call a server action, so every input is cleaned up first.
  return getGarmentCards(
    Math.max(1, Math.floor(Number(page)) || 1),
    parseSort(sort),
    parseFilters(filters),
  );
}

export async function loadFilterChoices(
  basePath: string,
  scope: unknown,
  filters: unknown,
  sort: string,
  view: string,
  field: string,
) {
  const known = FILTER_FIELDS.find((f) => f === field);
  if (!known || !/^\/[\w/.-]*$/.test(basePath)) return [];
  return getFilterChoices(
    basePath,
    parseFilters(scope),
    parseFilters(filters),
    parseSort(sort),
    view === "list" ? "list" : "grid",
    known,
  );
}
