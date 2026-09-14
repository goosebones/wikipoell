import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { touchIngestGarments } from "@/lib/ingest-garments";

/** PATCH /api/ingest/garments/touch — batch lastSeenAt for unchanged listings. */
export const PATCH = ingestRoute("touch garments", async (request) => {
  const body = await request.json();
  const result = await touchIngestGarments(body);
  return NextResponse.json(result);
});
