import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initMongo } from "@/lib/mongodb";
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

    const garment = await patchGarmentById(id, update);
    if (!garment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ garment });
  } catch (err) {
    console.error("Admin garment update error:", err);
    return NextResponse.json(
      { error: err.message || "Update failed" },
      { status: 500 },
    );
  }
}
