import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { storeGarmentImage, ImageValidationError } from "@/lib/garment-images";

export async function POST(request) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const garmentId = formData.get("garmentId");
    const imageId = formData.get("imageId");

    if (!file || typeof file === "string" || !garmentId || !imageId) {
      return NextResponse.json(
        { error: "Missing file or garmentId or imageId" },
        { status: 400 },
      );
    }

    const url = await storeGarmentImage(file, {
      groupId: garmentId,
      imageId,
    });

    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 },
    );
  }
}
