import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initMongo } from "@/lib/mongodb";
import Garment from "@/models/Garment";
import { recordAgentCorrection } from "@/lib/agent-corrections";
import {
  buildGarmentUpdate,
  patchGarmentById,
  validateGarmentStatus,
  GARMENT_PATCH_FIELDS_ADMIN,
} from "@/lib/patch-garment";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

export async function PATCH(request, { params }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await initMongo();
    const body = await request.json();
    const update = buildGarmentUpdate(body, GARMENT_PATCH_FIELDS_ADMIN);

    const statusError = validateGarmentStatus(update);
    if (statusError) {
      return NextResponse.json(
        { error: statusError.error },
        { status: statusError.status },
      );
    }

    // Snapshot before the edit so the change can be recorded as a training
    // example for the LLM pass.
    const previous = await Garment.findById(id).lean();
    if (!previous) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // From here on the ingest pipeline only refreshes lastSeenAt and appends
    // images — it never overwrites what a person decided (DESIGN.md §6).
    update["ingest.humanReviewedAt"] = new Date();

    const garment = await patchGarmentById(id, update);
    if (!garment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // The feedback loop: what a human corrected becomes a few-shot example.
    await recordAgentCorrection({ before: previous, after: garment });

    return NextResponse.json({ garment });
  } catch (err) {
    console.error("Admin garment update error:", err);
    return NextResponse.json(
      { error: err.message || "Update failed" },
      { status: 500 },
    );
  }
}
