import { Container, Title, Text, Group, Badge } from "@mantine/core";
import { getIngestRuns } from "@/lib/ingest-runs-admin";
import RunCard from "@/components/admin/ingest/run-card";

export default async function AdminRunsPage() {
  const runs = await getIngestRuns({ limit: 30 });
  const failed = runs.filter((r) => r.status === "failed").length;

  return (
    <Container
      size="lg"
      py="md"
    >
      <Group
        mb="md"
        align="center"
      >
        <Title>Ingest runs</Title>
        <Badge
          size="lg"
          variant="light"
          color="gray"
        >
          {runs.length} recent
        </Badge>
        {failed > 0 && (
          <Badge
            size="lg"
            color="red"
          >
            {failed} failed
          </Badge>
        )}
      </Group>

      <Text
        size="sm"
        c="dimmed"
        mb="lg"
      >
        Every garment carries the id of the run that created it, so a run that
        went wrong can be pulled off the site in one action. Unpublishing moves
        its garments back to pending — nothing is deleted.
      </Text>

      {runs.length === 0 ? (
        <Text c="dimmed">No runs yet.</Text>
      ) : (
        runs.map((run) => (
          <RunCard
            key={run._id}
            run={run}
          />
        ))
      )}
    </Container>
  );
}
