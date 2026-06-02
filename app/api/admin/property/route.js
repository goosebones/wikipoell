import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initMongo } from "@/lib/mongodb";
import { Property } from "@/lib/properties";
import crypto from "crypto";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

export async function POST(request) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await initMongo();
    const { propertyType, propertyName, garmentKey, garmentValue, description } = await request.json();

    if (!propertyType || !propertyName || !garmentKey || !garmentValue) {
      return NextResponse.json({ error: "propertyType, propertyName, garmentKey, and garmentValue are required" }, { status: 400 });
    }

    const property = await Property.create({
      _id: crypto.randomUUID(),
      propertyType,
      propertyName,
      garmentKey,
      garmentValue,
      description: description || undefined,
    });

    return NextResponse.json({ property: JSON.parse(JSON.stringify(property)) }, { status: 201 });
  } catch (err) {
    console.error("Admin property create error:", err);
    return NextResponse.json({ error: err.message || "Create failed" }, { status: 500 });
  }
}
