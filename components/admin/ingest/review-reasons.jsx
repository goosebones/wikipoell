"use client";

import { Badge, Group, Text, Tooltip } from "@mantine/core";
import { describeReviewReason, parseReviewReason } from "@/lib/ingest-review";

/**
 * Why the pipeline sent this garment to a person, as badges.
 * Renders nothing for user-submitted garments, which have no review record.
 */
export default function ReviewReasons({ reasons, stage, llm }) {
  if (!reasons?.length) return null;

  return (
    <Group
      gap={6}
      wrap="wrap"
      align="center"
    >
      {reasons.map((reason) => {
        const { color, label, hint } = parseReviewReason(reason);
        return (
          <Tooltip
            key={reason}
            label={hint || label}
            withArrow
            multiline
            w={240}
            events={{ hover: true, focus: true, touch: true }}
          >
            <Badge
              color={color}
              variant="light"
              size="sm"
              style={{ cursor: "help" }}
            >
              {describeReviewReason(reason)}
            </Badge>
          </Tooltip>
        );
      })}
      {stage === "llm" && llm?.confidence != null && (
        <Text
          size="xs"
          c="dimmed"
        >
          LLM {Math.round(llm.confidence * 100)}%
        </Text>
      )}
    </Group>
  );
}
