import Link from "next/link";
import { Container, Title, Text } from "@mantine/core";
import { getProperties } from "@/lib/properties";
import { getCategories } from "@/lib/categories";
import { initMongo } from "@/lib/mongodb";
import Garment from "@/models/Garment";
import AgentProposal from "@/models/AgentProposal";
import AgentProposalList from "@/components/admin/agent-proposal-list";

export default async function AgentReviewPage() {
  await initMongo();

  let proposals = await AgentProposal.find({})
    .sort({ runAt: -1, createdAt: -1 })
    .lean();

  if (proposals.length > 0) {
    const ids = proposals.map((p) => p.garmentId);
    const garments = await Garment.find(
      { _id: { $in: ids } },
      { images: 1, source: 1 },
    ).lean();
    const garmentMap = Object.fromEntries(
      garments.map((g) => [String(g._id), g]),
    );
    proposals = proposals.map((p) => {
      const g = garmentMap[p.garmentId] || {};
      return {
        ...p,
        _id: String(p._id),
        images: (g.images || []).slice(0, 3).map((i) => i.url),
        source: g.source || null,
      };
    });
  }

  const [properties, categories] = await Promise.all([
    getProperties(),
    getCategories(),
  ]);

  return (
    <Container
      size="lg"
      py="md"
    >
      <Link
        href="/admin"
        style={{ textDecoration: "none", display: "block" }}
      >
        ← Back to Admin
      </Link>
      <Title mb={4}>Agent Review</Title>
      <Text
        size="sm"
        mb="lg"
      >
        {proposals.length} proposals
      </Text>
      {proposals.length > 0 && (
        <AgentProposalList
          proposals={proposals}
          properties={properties}
          categories={categories}
        />
      )}
    </Container>
  );
}
