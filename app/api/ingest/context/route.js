import { NextResponse } from "next/server";
import { ingestRoute } from "@/lib/ingest-route";
import { ingestSystemUserId } from "@/lib/ingest-auth";
import { getProperties } from "@/lib/properties";
import { getCategories } from "@/lib/categories";
import AgentCorrection from "@/models/AgentCorrection";

const CORRECTIONS_LIMIT = 50;

/**
 * Everything a run needs up front, in one call: the vocabulary, the category
 * tree, recent human corrections for few-shot prompting, and who to
 * attribute garments to.
 */
export const GET = ingestRoute("context", async () => {
  const [properties, categories, corrections] = await Promise.all([
    getProperties(),
    getCategories(),
    AgentCorrection.find({})
      .sort({ updatedAt: -1 })
      .limit(CORRECTIONS_LIMIT)
      .lean(),
  ]);

  return NextResponse.json({
    systemUserId: ingestSystemUserId(),
    properties,
    categories,
    corrections: JSON.parse(JSON.stringify(corrections)),
  });
});
