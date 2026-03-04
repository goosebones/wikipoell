import { NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

import { initMongo } from "@/lib/mongodb";
import User from "@/models/User";

function getPrimaryEmail(userData) {
  const primaryId = userData.primary_email_address_id;
  if (!primaryId || !Array.isArray(userData.email_addresses)) return null;
  const primary = userData.email_addresses.find((e) => e.id === primaryId);
  return primary?.email_address ?? null;
}

export async function POST(request) {
  try {
    const evt = await verifyWebhook(request, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });

    await initMongo();

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const data = evt.data;
      const userId = data.id;
      const email = getPrimaryEmail(data);

      const update = {
        userId,
        username: data.username ?? undefined,
        imageUrl: data.image_url ?? undefined,
        email: email ?? undefined,
      };

      await User.findOneAndUpdate(
        { userId },
        { $set: update },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      );
    } else if (evt.type === "user.deleted") {
      const userId = evt.data.id;
      if (userId) {
        await User.findOneAndUpdate(
          { userId },
          { $set: { deletedAt: new Date() } },
          { new: true },
        );
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Clerk webhook error:", err);
    return NextResponse.json(
      { error: err.message || "Webhook verification failed" },
      { status: 400 },
    );
  }
}
