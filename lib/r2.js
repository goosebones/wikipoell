import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

let s3Client = null;

function getR2Client() {
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing R2 env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

function getPublicBase() {
  if (!publicUrl) throw new Error("R2_PUBLIC_URL is not set");
  return publicUrl.replace(/\/$/, "");
}

/**
 * Upload an image to R2
 *  *
 * @param {Buffer} body - File contents
 * @param {string} contentType - e.g. "image/webp"
 * @param {{ key: string }} options
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadToR2(body, contentType, { key }) {
  if (!key) throw new Error("key is required");

  const base = getPublicBase();

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return `${base}/${key}`;
}
