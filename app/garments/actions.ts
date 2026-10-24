// Server actions for garment grids. The browser calls `loadMoreGarments` as
// the visitor scrolls, to fetch the next page of cards in the grid's current
// sort and filters (the page's own and the visitor's together).
"use server";

import { parseFilters } from "@/lib/filters";
import { getGarmentCards, parseSort } from "@/lib/garments";

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
