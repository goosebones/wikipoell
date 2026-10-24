// Server actions for search. The search box calls `searchArchive` as the
// visitor types, for the handful of best matches shown beneath it.
"use server";

import { search } from "@/lib/search";

export async function searchArchive(query: unknown) {
  // Anyone can call a server action, so the query is cleaned up first.
  return search(String(query ?? "").slice(0, 100), 8);
}
