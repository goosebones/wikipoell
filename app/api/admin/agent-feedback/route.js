import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { initMongo } from "@/lib/mongodb";
import AgentCorrection from "@/models/AgentCorrection";

function isAdmin(sessionClaims) {
  return sessionClaims?.metadata?.role === "admin";
}

const FIELDS = [
  "title",
  "category",
  "type",
  "gender",
  "model",
  "procedure",
  "material",
  "process",
  "color",
];

export async function POST(request) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdmin(sessionClaims)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await initMongo();
    const { garmentId, before, agentProposed, accepted, images } =
      await request.json();

    const changed = {};
    for (const f of FIELDS) {
      const b = JSON.stringify(before[f] ?? null);
      const a = JSON.stringify(accepted[f] ?? null);
      if (b !== a)
        changed[f] = { before: before[f] ?? null, after: accepted[f] ?? null };
    }

    await AgentCorrection.findOneAndUpdate(
      { garmentId },
      {
        garmentId,
        before: Object.fromEntries(FIELDS.map((f) => [f, before[f] ?? null])),
        agentProposed: agentProposed ?? null,
        after: Object.fromEntries(FIELDS.map((f) => [f, accepted[f] ?? null])),
        changed,
        images: (images || []).slice(0, 3),
        source: "agent-feedback",
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({ ok: true, changed: Object.keys(changed) });
  } catch (err) {
    console.error("Agent feedback error:", err);
    return NextResponse.json(
      { error: err.message || "Failed" },
      { status: 500 },
    );
  }
}
