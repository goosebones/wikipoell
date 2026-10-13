// POST /api/webhooks/clerk: Clerk calls this whenever a user is created,
// updated or deleted, and the change is copied into the `users` collection.
// Requests are verified against CLERK_WEBHOOK_SIGNING_SECRET; anything not
// signed by Clerk is turned away with a 400.
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { markUserDeleted, saveUser } from "@/lib/users";

export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    await saveUser(event.data);
  }
  if (event.type === "user.deleted" && event.data.id) {
    await markUserDeleted(event.data.id);
  }
  // Profiles show the change on the next visit, renamed and deleted ones too.
  revalidateTag("users", { expire: 0 });
  return Response.json({ received: true });
}
