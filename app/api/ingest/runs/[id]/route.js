import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { updateIngestRun } from "@/lib/ingest-runs";

/** PATCH /api/ingest/runs/:id — progress, and completion when status changes. */
export const PATCH = ingestRoute("update run", async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const result = await updateIngestRun(id, body);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result);
});
