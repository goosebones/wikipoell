import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initMongo } from "@/lib/mongodb";
import AgentProposal from "@/models/AgentProposal";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

export async function PATCH(request, { params }) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await initMongo();
    const { id } = await params;
    const { status } = await request.json();

    if (!["pending", "accepted", "skipped"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const doc = await AgentProposal.findByIdAndUpdate(id, { status }, { new: true });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
