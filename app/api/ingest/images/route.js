import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { storeGarmentImage } from "@/lib/garment-images";

/**
 * POST /api/ingest/images — multipart `file` + `imageGroupId` (+ optional
 * `imageId`). Same WebP → R2 path as user uploads, so pipeline images are
 * indistinguishable from submitted ones.
 */
export const POST = ingestRoute("upload image", async (request) => {
  const formData = await request.formData();
  const file = formData.get("file");
  const groupId = formData.get("imageGroupId");
  const imageId = formData.get("imageId") || randomUUID();

  if (!groupId || typeof groupId !== "string") {
    return NextResponse.json(
      { error: "imageGroupId is required" },
      { status: 400 },
    );
  }

  const url = await storeGarmentImage(file, { groupId, imageId });
  return NextResponse.json({ url, imageGroupId: groupId, imageId });
});
