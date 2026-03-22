import { NextResponse } from "next/server";
import { getProperties } from "@/lib/properties";

export async function GET() {
  try {
    const properties = await getProperties();
    return NextResponse.json(properties, { status: 200 });
  } catch (err) {
    console.error("Get properties error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch properties" },
      { status: 500 },
    );
  }
}
