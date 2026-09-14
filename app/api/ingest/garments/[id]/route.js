import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { updateIngestGarment } from "@/lib/ingest-garments";

/** PATCH /api/ingest/garments/:id — re-scrape update, policy enforced in lib. */
export const PATCH = ingestRoute(
  "update garment",
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const result = await updateIngestGarment(id, body);
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  },
);
