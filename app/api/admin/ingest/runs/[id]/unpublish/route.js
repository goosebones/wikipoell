import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unpublishIngestRun } from "@/lib/ingest-runs-admin";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

/**
 * POST /api/admin/ingest/runs/:id/unpublish
 *
 * The kill switch for a bad pipeline run. Clerk-authenticated, not the
 * service token — this is a person's decision, not the pipeline's.
 */
export async function POST(_request, { params }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await unpublishIngestRun(id);
    if (!result) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("Unpublish run error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to unpublish run" },
      { status: 500 },
    );
  }
}
