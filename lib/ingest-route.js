import { NextResponse } from "next/server";
import { initMongo } from "@/lib/mongodb";
import { requireIngestToken } from "@/lib/ingest-auth";

/**
 * Wraps an /api/ingest/* handler: token check, Mongo init, and mapping of
 * typed errors (anything with a numeric `status`) to responses. Keeps every
 * route down to its actual logic.
 *
 * @param {string} label used in the server log on unexpected failures
 * @param {(request: Request, ctx: any) => Promise<NextResponse>} handler
 */
export function ingestRoute(label, handler) {
  return async function (request, ctx) {
    const denied = requireIngestToken(request);
    if (denied) return denied;

    try {
      await initMongo();
      return await handler(request, ctx);
    } catch (err) {
      if (typeof err?.status === "number" && err.status < 500) {
        return NextResponse.json(
          { error: err.message, ...(err.existingId && { id: err.existingId }) },
          { status: err.status },
        );
      }
      console.error(`Ingest ${label} error:`, err);
      return NextResponse.json(
        { error: err.message || "Ingest request failed" },
        { status: 500 },
      );
    }
  };
}
