// Server actions for the archive grid. The browser calls `loadMoreGarments`
// as the visitor scrolls, to fetch the next page of cards.
"use server";

import { getGarmentCards } from "@/lib/garments";

export async function loadMoreGarments(page: number) {
  // Anyone can call a server action, so the page number is cleaned up first.
  return getGarmentCards(Math.max(1, Math.floor(Number(page)) || 1));
}
