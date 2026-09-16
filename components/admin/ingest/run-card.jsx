"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Group, Table, Text } from "@mantine/core";

const STATUS_COLOR = { completed: "green", running: "blue", failed: "red" };

function duration(ms) {
  if (!ms) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export default function RunCard({ run }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const totals = run.totals ?? {};
  const canUnpublish = run.garmentsPublished > 0;

  async function handleUnpublish() {
    if (
      !window.confirm(
        `Move ${run.garmentsPublished} published garment(s) from this run back ` +
          `to pending? They stay in the archive and land in the review queue.`,
      )
    ) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ingest/runs/${run._id}/unpublish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(data.unpublished);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card
      withBorder
      shadow="sm"
      p="sm"
      mb="sm"
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        mb={6}
      >
        <Group gap="xs">
          <Badge
            color={STATUS_COLOR[run.status] ?? "gray"}
            variant="light"
          >
            {run.status}
          </Badge>
          <Text
            size="sm"
            fw={500}
          >
            {new Date(run.startedAt).toLocaleString()}
          </Text>
          <Text
            size="xs"
            c="dimmed"
          >
            {duration(run.durationMs)} · {run.trigger} · {run._id.slice(0, 8)}
          </Text>
          {run.options?.dryRun && (
            <Badge
              size="xs"
              color="gray"
            >
              dry run
            </Badge>
          )}
        </Group>

        {canUnpublish && (
          <Button
            size="xs"
            color="red"
            variant="light"
            loading={working}
            onClick={handleUnpublish}
          >
            Unpublish {run.garmentsPublished}
          </Button>
        )}
      </Group>

      <Text
        size="xs"
        c="dimmed"
        mb={6}
      >
        {totals.listingsFound ?? 0} found · {totals.unchanged ?? 0} unchanged ·{" "}
        {totals.created ?? 0} created · {totals.updated ?? 0} updated ·{" "}
        {totals.published ?? 0} published · {totals.needsReview ?? 0} to review
        · {totals.imagesCopied ?? 0} images
        {totals.llmCalls ? ` · ${totals.llmCalls} LLM calls` : ""}
      </Text>

      {run.sources?.length > 0 && (
        <Table
          fz="xs"
          verticalSpacing={2}
        >
          <Table.Tbody>
            {run.sources.map((s) => (
              <Table.Tr key={s.name}>
                <Table.Td w={110}>{s.name}</Table.Td>
                <Table.Td w={90}>
                  <Badge
                    size="xs"
                    color={STATUS_COLOR[s.status] ?? "gray"}
                    variant="light"
                  >
                    {s.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {s.listingsFound} found, {s.created} created, {s.updated}{" "}
                  updated, {s.failed} failed
                </Table.Td>
                <Table.Td c="red">{s.error}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {run.failures?.length > 0 && (
        <Text
          size="xs"
          c="red"
          mt={4}
          lineClamp={3}
        >
          {run.failures.length} listing failure(s): {run.failures[0].message}
        </Text>
      )}

      {done != null && (
        <Text
          size="xs"
          c="orange"
          mt={4}
        >
          Moved {done} garment(s) back to pending.
        </Text>
      )}
      {error && (
        <Text
          size="xs"
          c="red"
          mt={4}
        >
          {error}
        </Text>
      )}
    </Card>
  );
}
