import { NextResponse } from "next/server";
import sharp from "sharp";
import { uploadToR2 } from "@/lib/r2";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const garmentId = formData.get("garmentId");
    const imageId = formData.get("imageId");

    if (!file || typeof file === "string" || !garmentId || !imageId) {
      return NextResponse.json(
        { error: "Missing file or garmentId or imageId" },
        { status: 400 }
      );
    }

    const { type, size } = file;
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." },
        { status: 400 }
      );
    }
    if (size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 10MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();

    const url = await uploadToR2(webpBuffer, "image/webp", {
      key: `${garmentId}/${imageId}.webp`,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
