// Homepage background images in Cloudflare R2 (the bucket behind
// media-background.wikipoell.com). Uploads are converted to WebP, capped at
// 2560px wide so they stay a sensible size, and stored under a random name.
// The background bucket has its own R2 API token, separate from the garment
// photos' (which only the ingest pipeline writes with). Needs R2_ACCOUNT_ID,
// R2_BACKGROUND_ACCESS_KEY_ID, R2_BACKGROUND_SECRET_ACCESS_KEY,
// R2_BACKGROUND_BUCKET_NAME and R2_BACKGROUND_PUBLIC_URL.
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

// The bucket, its public address and a client, read from the environment on
// each use, so changed keys take effect without restarting the server.
function storage() {
  const env = process.env;
  return {
    bucket: env.R2_BACKGROUND_BUCKET_NAME!,
    publicBase: (env.R2_BACKGROUND_PUBLIC_URL ?? "").replace(/\/$/, ""),
    client: new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_BACKGROUND_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_BACKGROUND_SECRET_ACCESS_KEY!,
      },
    }),
  };
}

// Stores an image as WebP and returns its public URL.
export async function uploadBackground(image: Buffer) {
  const webp = await sharp(image)
    .rotate()
    .resize({ width: 2560, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const { bucket, publicBase, client } = storage();
  const key = `${crypto.randomUUID()}.webp`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: webp,
      ContentType: "image/webp",
    }),
  );
  return `${publicBase}/${key}`;
}

// Deletes an image this bucket serves; URLs from anywhere else are left
// alone.
export async function deleteBackground(url: string) {
  const { bucket, publicBase, client } = storage();
  if (!publicBase || !url.startsWith(`${publicBase}/`)) return;
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: url.slice(publicBase.length + 1),
    }),
  );
}
