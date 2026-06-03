import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updatePropertyById, deletePropertyById } from "@/lib/properties";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

export async function PATCH(request, { params }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  try {
    const body = await request.json();
    const { propertyType, propertyName, garmentKey, garmentValue, description } =
      body;

    if (!propertyType || !propertyName || !garmentKey || !garmentValue) {
      return NextResponse.json(
        {
          error:
            "propertyType, propertyName, garmentKey, and garmentValue are required",
        },
        { status: 400 },
      );
    }

    const property = await updatePropertyById(id, {
      propertyType,
      propertyName,
      garmentKey,
      garmentValue,
      description: description || undefined,
    });
    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ property });
  } catch (err) {
    console.error("Admin property update error:", err);
    return NextResponse.json(
      { error: err.message || "Update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  try {
    const property = await deletePropertyById(id);
    if (!property) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin property delete error:", err);
    return NextResponse.json(
      { error: err.message || "Delete failed" },
      { status: 500 },
    );
  }
}
