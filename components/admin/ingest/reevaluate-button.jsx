"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Group, List, Modal, Text } from "@mantine/core";
import { RefreshCw } from "lucide-react";
import { describeReviewReason, parseReviewReason } from "@/lib/ingest-review";

/**
 * Re-checks the blockers recorded on pending garments and publishes the ones
 * nothing blocks any more — the payoff for adding a missing property value.
 *
 * Always previews first: publishing a batch should be a decision, not a
 * side effect of clicking a button.
 */
export default function ReevaluateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  async function call(apply) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ingest/reevaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function openPreview() {
    setOpen(true);
    setDone(null);
    setPreview(null);
    const data = await call(false);
    if (data) setPreview(data);
  }

  async function confirm() {
    const data = await call(true);
    if (data) {
      setDone(data);
      setPreview(null);
      router.refresh();
    }
  }

  const count = preview?.willPublishCount ?? 0;

  return (
    <>
      <Button
        size="xs"
        variant="light"
        leftSection={<RefreshCw size={14} />}
        onClick={openPreview}
      >
        Re-check queue
      </Button>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Re-check review queue"
        size="lg"
      >
        {loading && !preview && <Text size="sm">Checking…</Text>}

        {error && (
          <Alert
            color="red"
            mb="sm"
          >
            {error}
          </Alert>
        )}

        {done && (
          <Alert color="green">
            <Text
              size="sm"
              fw={600}
            >
              Published {done.published} garment
              {done.published === 1 ? "" : "s"}.
            </Text>
            {done.runId && (
              <Text
                size="xs"
                mt={4}
              >
                Recorded as run {done.runId.slice(0, 8)} — revert it from{" "}
                <a href="/admin/runs">Ingest runs</a> if this was wrong.
              </Text>
            )}
          </Alert>
        )}

        {preview && (
          <>
            <Text
              size="sm"
              mb="sm"
            >
              Re-checked <b>{preview.examined}</b> pending garments against the
              current vocabulary. Nothing is scraped and no fields are inferred
              — only the recorded blockers are re-tested.
            </Text>

            {count === 0 ? (
              <Alert color="gray">
                Nothing is newly unblocked. {preview.stillBlocked} garment
                {preview.stillBlocked === 1 ? " is" : "s are"} still waiting on
                something.
              </Alert>
            ) : (
              <>
                <Alert
                  color="blue"
                  mb="sm"
                >
                  <Text
                    size="sm"
                    fw={600}
                  >
                    {count} garment{count === 1 ? "" : "s"} will be published.
                  </Text>
                  <Text
                    size="xs"
                    mt={2}
                  >
                    {preview.stillBlocked} still blocked
                    {preview.skippedEditedCount > 0 &&
                      `, ${preview.skippedEditedCount} skipped because you have edited them`}
                    .
                  </Text>
                </Alert>

                <Text
                  size="xs"
                  fw={600}
                  mb={4}
                >
                  Cleared by:
                </Text>
                <Group
                  gap={6}
                  mb="sm"
                >
                  {preview.clearedBy
                    .slice(0, 12)
                    .map(({ reason, count: n }) => (
                      <Badge
                        key={reason}
                        size="sm"
                        variant="light"
                        color={parseReviewReason(reason).color}
                      >
                        {describeReviewReason(reason)} · {n}
                      </Badge>
                    ))}
                </Group>

                <Text
                  size="xs"
                  fw={600}
                  mb={4}
                >
                  Sample:
                </Text>
                <List
                  size="xs"
                  spacing={2}
                  mb="md"
                >
                  {preview.willPublish.slice(0, 8).map((g) => (
                    <List.Item key={g._id}>{g.title}</List.Item>
                  ))}
                </List>
              </>
            )}

            {preview.skippedEditedCount > 0 && (
              <Text
                size="xs"
                c="dimmed"
                mb="sm"
              >
                Garments you have already edited are never auto-published —
                publish those yourself from the queue.
              </Text>
            )}

            <Group justify="flex-end">
              <Button
                size="xs"
                variant="default"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              {count > 0 && (
                <Button
                  size="xs"
                  loading={loading}
                  onClick={confirm}
                >
                  Publish {count}
                </Button>
              )}
            </Group>
          </>
        )}
      </Modal>
    </>
  );
}
