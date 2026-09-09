import { Container, Title, Text, Group, Badge } from "@mantine/core";
import { getProperties } from "@/lib/properties";
import {
  getAgentProposalStatusCounts,
  getAgentProposalsQueue,
} from "@/lib/agent-proposals";
import AgentProposalCard from "@/components/admin/agent-proposal/agent-proposal-card";
import AdminPagination from "@/components/admin/admin-pagination";

const PAGE_SIZE = 30;
const STATUSES = [
  { value: "pending", label: "pending", color: "yellow" },
  { value: "accepted", label: "accepted", color: "green" },
  { value: "skipped", label: "skipped", color: "gray" },
];

export default async function AgentReviewPage({ searchParams }) {
  const resolved = await searchParams;
  const statusFilter = resolved.status ?? "pending";
  const page = Math.max(1, parseInt(resolved.page ?? "1", 10));

  const [{ proposals, total }, properties, counts] = await Promise.all([
    getAgentProposalsQueue({
      status: statusFilter,
      page,
      limit: PAGE_SIZE,
    }),
    getProperties(),
    getAgentProposalStatusCounts(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeStatus = STATUSES.find((s) => s.value === statusFilter);

  return (
    <Container
      size="lg"
      py="md"
    >
      <Group
        mb="md"
        align="center"
      >
        <Title>Agent Review</Title>
        <Badge
          color={activeStatus?.color ?? "gray"}
          size="lg"
        >
          {total} {statusFilter}
        </Badge>
      </Group>

      <Group
        mb="lg"
        gap="xs"
      >
        {STATUSES.map(({ value, label, color }) => {
          const count = counts[value] ?? 0;
          const active = statusFilter === value;
          return (
            <a
              key={value}
              href={`/admin/agent?status=${value}`}
              style={{ textDecoration: "none" }}
            >
              <Badge
                color={color}
                variant={active ? "filled" : "light"}
                style={{ cursor: "pointer" }}
              >
                {count} {label}
              </Badge>
            </a>
          );
        })}
      </Group>

      {proposals.length === 0 ? (
        <Text c="dimmed">No {statusFilter} proposals.</Text>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {proposals.map((proposal) => (
            <AgentProposalCard
              key={proposal._id}
              proposal={proposal}
              properties={properties}
              status={statusFilter}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          status={statusFilter}
          basePath="/admin/agent"
        />
      )}
    </Container>
  );
}
