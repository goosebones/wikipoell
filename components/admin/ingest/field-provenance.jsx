"use client";

import { Group, Text, Tooltip } from "@mantine/core";
import { ORIGIN_LABEL, confidenceColor } from "@/lib/ingest-review";

/**
 * Per-field confidence and where the value came from.
 *
 * This is the difference between "the pipeline says material is ROOMS" and
 * "the pipeline read ROOMS straight out of the article code" — the first is a
 * claim, the second is structured data, and they warrant different amounts of
 * checking.
 */
export default function FieldProvenance({ fields }) {
  const entries = Object.entries(fields ?? {}).filter(
    ([, v]) => v && typeof v === "object" && "origin" in v,
  );
  if (entries.length === 0) return null;

  return (
    <Group
      gap={5}
      wrap="wrap"
      mt={4}
    >
      <Text
        size="xs"
        c="dimmed"
        mr={2}
      >
        read from:
      </Text>
      {entries.map(([name, { confidence, origin }]) => (
        <Tooltip
          key={name}
          label={`${name}: ${ORIGIN_LABEL[origin] ?? origin}, ${Math.round(
            (confidence ?? 0) * 100,
          )}% confidence`}
          withArrow
        >
          <Text
            size="xs"
            span
            c={confidenceColor(confidence)}
            style={{ cursor: "help" }}
          >
            {name}
            <Text
              span
              c="dimmed"
            >
              ·{ORIGIN_LABEL[origin] ?? origin}
            </Text>
          </Text>
        </Tooltip>
      ))}
    </Group>
  );
}
