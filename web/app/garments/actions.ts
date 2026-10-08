// Server actions for the archive grid. The browser calls `loadMoreGarments`
// as the visitor scrolls, to fetch the next page of cards in the current sort.
"use server";

import { getGarmentCards, parseSort } from "@/lib/garments";

export async function loadMoreGarments(sort: string, page: number) {
  // Anyone can call a server action, so both inputs are cleaned up first.
  return getGarmentCards(
    Math.max(1, Math.floor(Number(page)) || 1),
    parseSort(sort),
  );
}
