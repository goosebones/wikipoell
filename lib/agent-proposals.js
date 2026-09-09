import { initMongo } from "./mongodb";
import AgentProposal from "@/models/AgentProposal";
import Garment from "@/models/Garment";

export async function getAgentProposalStatusCounts() {
  try {
    await initMongo();
    const rows = await AgentProposal.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const counts = { pending: 0, accepted: 0, skipped: 0 };
    for (const { _id, count } of rows) {
      if (_id in counts) counts[_id] = count;
    }
    return counts;
  } catch (error) {
    console.error("Error counting agent proposals:", error);
    throw new Error("Failed to count agent proposals");
  }
}

export async function getAgentProposalsQueue({
  status = "pending",
  page = 1,
  limit = 30,
} = {}) {
  try {
    await initMongo();
    const query = { status };
    const skip = (page - 1) * limit;
    const [proposals, total] = await Promise.all([
      AgentProposal.find(query)
        .sort({ runAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AgentProposal.countDocuments(query),
    ]);

    if (proposals.length === 0) {
      return {
        proposals: [],
        total,
        page,
        limit,
      };
    }

    const ids = proposals.map((p) => p.garmentId);
    const garments = await Garment.find(
      { _id: { $in: ids } },
      { images: 1, source: 1 },
    ).lean();
    const garmentMap = Object.fromEntries(
      garments.map((g) => [String(g._id), g]),
    );

    const enriched = proposals.map((p) => {
      const g = garmentMap[p.garmentId] || {};
      return {
        ...p,
        _id: String(p._id),
        images: (g.images || []).slice(0, 3).map((i) => i.url),
        source: g.source || null,
      };
    });

    return {
      proposals: JSON.parse(JSON.stringify(enriched)),
      total,
      page,
      limit,
    };
  } catch (error) {
    console.error("Error fetching agent proposals:", error);
    throw new Error("Failed to fetch agent proposals");
  }
}
