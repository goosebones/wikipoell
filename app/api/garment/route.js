import { NextResponse } from "next/server";
import { initMongo } from "@/lib/mongodb";
import Garment from "@/models/Garment";
import { auth } from "@clerk/nextjs/server";

/**
 * Accept string | string[] | null from clients.
 * - Trims strings; drops empty entries from arrays.
 * - Single value after cleanup → string (matches legacy documents).
 * - Multiple values → string[].
 */
function normalizeProcedure(procedure) {
  if (procedure == null || procedure === "") return null;
  if (typeof procedure === "string") {
    const t = procedure.trim();
    return t.length ? t : null;
  }
  if (Array.isArray(procedure)) {
    const cleaned = procedure
      .filter((p) => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (cleaned.length === 0) return null;
    if (cleaned.length === 1) return cleaned[0];
    return cleaned;
  }
  return null;
}

export async function POST(request) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initMongo();

    const body = await request.json();

    const {
      imageGroupId,
      category,
      type,
      gender,
      procedure,
      material,
      process,
      color,
      title,
      model,
      images,
      uploadedByUserId,
      source,
    } = body || {};

    const imageList = Array.isArray(images)
      ? images
          .map((item) =>
            typeof item === "string"
              ? { url: item }
              : item && typeof item.url === "string"
                ? { ...item, url: item.url }
                : null,
          )
          .filter((item) => item && item.url.length > 0)
      : [];

    if (imageList.length === 0) {
      return NextResponse.json(
        { error: "At least one image URL is required" },
        { status: 400 },
      );
    }

    let sourceDoc = null;

    if (source && typeof source === "object") {
      if (source.type === "me") {
        sourceDoc = { type: "me" };
      } else if (source.type === "external") {
        const label =
          typeof source.label === "string"
            ? source.label.trim() || undefined
            : undefined;
        const url =
          typeof source.url === "string"
            ? source.url.trim() || undefined
            : undefined;

        if (label || url) {
          sourceDoc = {
            type: "external",
            ...(label && { label }),
            ...(url && { url }),
          };
        }
      }
    }

    const doc = await Garment.create({
      imageGroupId,
      category: category ?? null,
      type: type ?? null,
      gender: gender ?? null,
      procedure: normalizeProcedure(procedure),
      material: material ?? null,
      process: process ?? null,
      color: color ?? null,
      title: title ?? null,
      model: model ?? null,
      images: imageList,
      uploadedByUserId: uploadedByUserId ?? null,
      ...(sourceDoc && { source: sourceDoc }),
    });

    return NextResponse.json(
      {
        id: doc._id.toString(),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Save garment error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save garment" },
      { status: 500 },
    );
  }
}
