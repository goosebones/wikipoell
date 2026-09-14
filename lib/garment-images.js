import sharp from "sharp";
import { uploadToR2 } from "@/lib/r2";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/** Thrown for caller mistakes; routes map it to a 400. */
export class ImageValidationError extends Error {
  status = 400;
}

/**
 * The one path every garment image takes into storage: validate, convert to
 * WebP, upload to R2 under `<groupId>/<imageId>.webp`.
 *
 * Shared by the user upload route and the ingest route so both produce
 * identical objects.
 *
 * @param {File} file
 * @param {{ groupId: string, imageId: string }} key
 * @returns {Promise<string>} public URL
 */
export async function storeGarmentImage(file, { groupId, imageId }) {
  if (!file || typeof file === "string") {
    throw new ImageValidationError("Missing file");
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageValidationError(
      "Invalid file type. Use JPEG, PNG, GIF, or WebP.",
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("File too large. Max 10MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();

  return uploadToR2(webpBuffer, "image/webp", {
    key: `${groupId}/${imageId}.webp`,
  });
}
