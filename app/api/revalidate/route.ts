// POST /api/revalidate: drops the cached garment pages, so garments the
// ingest pipeline just wrote show at once instead of when the hourly cache
// expires. The pipeline calls it once at the end of a run, with
// `Authorization: Bearer <REVALIDATE_TOKEN>`; without the token set, nothing
// is accepted.
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const token = Buffer.from(process.env.REVALIDATE_TOKEN ?? "");
  const given = Buffer.from(
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
  );
  if (
    token.length === 0 ||
    given.length !== token.length ||
    !timingSafeEqual(given, token)
  ) {
    return new Response("Not allowed", { status: 403 });
  }
  revalidateTag("garments", { expire: 0 });
  return Response.json({ revalidated: ["garments"] });
}
