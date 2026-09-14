import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Service auth for /api/ingest/*.
 *
 * There is exactly one caller — the wikipoell-ingest pipeline — so this is a
 * shared bearer token rather than Clerk. Nothing outside /api/ingest/ accepts
 * it, and these routes accept nothing else.
 *
 * @returns {NextResponse | null} a response to return immediately, or null
 *   when the request is authorised.
 */
export function requireIngestToken(request) {
  const expected = process.env.INGEST_API_TOKEN;
  if (!expected) {
    // Fail closed: a missing token must never mean "accept anything".
    return NextResponse.json(
      { error: "Ingest API is not configured" },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, presented] = header.split(" ");
  if (scheme !== "Bearer" || !presented) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/** The Clerk user id every pipeline-created garment is attributed to. */
export function ingestSystemUserId() {
  const id = process.env.INGEST_SYSTEM_USER_ID;
  if (!id) throw new Error("INGEST_SYSTEM_USER_ID is not set");
  return id;
}
