import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initMongo } from "@/lib/mongodb";
import Garment from "@/models/Garment";
import {
  buildGarmentUpdate,
  patchGarmentById,
  GARMENT_PATCH_FIELDS_OWNER,
} from "@/lib/patch-garment";

export async function PATCH(request, { params }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await initMongo();
    const garment = await Garment.findById(id);
    if (!garment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (garment.uploadedByUserId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const update = buildGarmentUpdate(body, GARMENT_PATCH_FIELDS_OWNER);
    const updated = await patchGarmentById(id, update);
    return NextResponse.json({ garment: updated });
  } catch (err) {
    console.error("Garment update error:", err);
    return NextResponse.json(
      { error: err.message || "Update failed" },
      { status: 500 },
    );
  }
}
