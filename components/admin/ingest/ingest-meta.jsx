"use client";

import { Anchor, Group, Text } from "@mantine/core";
import ReviewReasons from "@/components/admin/ingest/review-reasons";
import FieldProvenance from "@/components/admin/ingest/field-provenance";

function shortDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Everything the pipeline recorded about one garment, for the review queue.
 * Absent on user submissions, in which case this renders nothing.
 */
export default function IngestMeta({ ingest }) {
  if (!ingest?.source) return null;
  const review = ingest.review ?? {};
  const lastSeen = shortDate(ingest.lastSeenAt);

  return (
    <div style={{ marginBottom: 8 }}>
      <ReviewReasons
        reasons={review.reasons}
        stage={review.stage}
        llm={review.llm}
      />
      <FieldProvenance fields={review.fields} />
      {review.llm?.notes && (
        <Text
          size="xs"
          c="dimmed"
          mt={4}
          lineClamp={2}
        >
          {review.llm.notes}
        </Text>
      )}
      <Group
        gap={10}
        mt={4}
      >
        <Text
          size="xs"
          c="dimmed"
        >
          {ingest.source}
        </Text>
        {ingest.sourceUrl && (
          <Anchor
            size="xs"
            href={ingest.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            listing ↗
          </Anchor>
        )}
        {lastSeen && (
          <Text
            size="xs"
            c="dimmed"
          >
            last seen {lastSeen}
          </Text>
        )}
        {ingest.runId && (
          <Text
            size="xs"
            c="dimmed"
          >
            run {ingest.runId.slice(0, 8)}
          </Text>
        )}
      </Group>
    </div>
  );
}
