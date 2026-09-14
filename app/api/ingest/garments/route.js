import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { listIngestGarments, createIngestGarment } from "@/lib/ingest-garments";

/** GET /api/ingest/garments?source=ccp-room — the dedup index for one source. */
export const GET = ingestRoute("list garments", async (request) => {
  const source = new URL(request.url).searchParams.get("source");
  const garments = await listIngestGarments(source);
  return NextResponse.json({ source, garments });
});

/** POST /api/ingest/garments — create; `publish` decides pending vs published. */
export const POST = ingestRoute("create garment", async (request) => {
  const body = await request.json();
  const result = await createIngestGarment(body);
  return NextResponse.json(result, { status: 201 });
});
