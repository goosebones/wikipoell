import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  previewReevaluation,
  applyReevaluation,
} from "@/lib/ingest-reevaluate";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

/**
 * POST /api/admin/ingest/reevaluate
 *
 * Body `{ apply: false }` (default) previews; `{ apply: true }` publishes.
 * The apply path recomputes from scratch rather than trusting ids from the
 * preview, so a stale confirmation cannot publish a still-blocked garment.
 */
export async function POST(request) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = body?.apply
      ? await applyReevaluation()
      : await previewReevaluation();
    // The full garment lists are only needed for the preview's sample.
    return NextResponse.json({
      ...result,
      willPublish: result.willPublish.slice(0, 50),
      willPublishCount: result.willPublish.length,
      skippedEditedCount: result.skippedEdited.length,
      skippedEdited: result.skippedEdited.slice(0, 20),
    });
  } catch (err) {
    console.error("Re-evaluate error:", err);
    return NextResponse.json(
      { error: err.message || "Re-evaluation failed" },
      { status: 500 },
    );
  }
}
