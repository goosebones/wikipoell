// Server actions for garment grids. The browser calls `loadMoreGarments` as
// the visitor scrolls, to fetch the next page of cards in the grid's current
// sort and scope (the whole archive, or one category, color, material or
// model).
"use server";

import { getGarmentCards, parseScope, parseSort } from "@/lib/garments";

export async function loadMoreGarments(
  sort: string,
  scope: unknown,
  page: number,
) {
  // Anyone can call a server action, so every input is cleaned up first.
  return getGarmentCards(
    Math.max(1, Math.floor(Number(page)) || 1),
    parseSort(sort),
    parseScope(scope),
  );
}
