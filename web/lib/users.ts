// Users, as mirrored from Clerk. Clerk owns accounts; the `users` collection
// keeps the parts the site shows (username, avatar, join date) so profiles can
// be found by username, and it's kept in sync by the Clerk webhook
// (app/api/webhooks/clerk). Deleted accounts are marked, not removed, so
// anything they're linked to keeps its owner.
import type { UserJSON } from "@clerk/nextjs/server";
import { cacheLife, cacheTag } from "next/cache";
import { users } from "@/lib/db";

// Stores a created or updated Clerk user.
export async function saveUser(data: UserJSON) {
  const email = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  await users.updateOne(
    { userId: data.id },
    {
      $set: {
        username: data.username,
        email: email?.email_address ?? null,
        imageUrl: data.image_url,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(data.created_at),
        deletedAt: null,
      },
    },
    { upsert: true },
  );
}

export async function markUserDeleted(userId: string) {
  await users.updateOne({ userId }, { $set: { deletedAt: new Date() } });
}

// A public profile by username, or null if no live account has it. Cached
// under "users", which the webhook refreshes on every change.
export async function getProfile(username: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("users");

  const user = await users.findOne({ username, deletedAt: null });
  return (
    user && {
      userId: user.userId,
      username,
      imageUrl: user.imageUrl,
      joined: user.createdAt,
    }
  );
}
