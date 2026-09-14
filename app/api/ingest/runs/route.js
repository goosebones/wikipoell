import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { createIngestRun } from "@/lib/ingest-runs";

/** POST /api/ingest/runs — open a run; returns the runId to stamp on garments. */
export const POST = ingestRoute("create run", async (request) => {
  const body = await request.json().catch(() => ({}));
  const result = await createIngestRun(body);
  return NextResponse.json(result, { status: 201 });
});
