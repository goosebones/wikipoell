import { NextResponse } from "next/server";
import { initMongo } from "@/lib/mongodb";
import Garment from "@/models/Garment";
import { auth } from "@clerk/nextjs/server";

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
    } = body || {};

    if (!imageGroupId) {
      return NextResponse.json(
        { error: "imageGroupId is required" },
        { status: 400 },
      );
    }

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

    const doc = await Garment.create({
      imageGroupId,
      category: category ?? null,
      type: type ?? null,
      gender: gender ?? null,
      procedure: procedure ?? null,
      material: material ?? null,
      process: process ?? null,
      color: color ?? null,
      title: title ?? null,
      model: model ?? null,
      images: imageList,
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
