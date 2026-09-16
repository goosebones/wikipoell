"use client";

import { Badge, Group, Text, Tooltip } from "@mantine/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { describeReviewReason, parseReviewReason } from "@/lib/ingest-review";

const VISIBLE = 12;

/**
 * The queue's blockers, ranked by how many garments share each one.
 *
 * Clicking narrows the queue to exactly those garments. The point is that
 * most of a review backlog is a handful of repeated causes — one missing
 * property value can account for dozens of garments, and fixing it once
 * clears them all.
 */
export default function ReasonFilterBar({ reasons, sources, reason, source }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (!reasons?.length && !sources?.length) return null;

  const go = (key, value) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value && params.get(key) !== value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => router.push(`/admin?${params.toString()}`));
  };

  return (
    <div style={{ marginBottom: "0.75rem", opacity: pending ? 0.6 : 1 }}>
      {sources.length > 1 && (
        <Group
          gap={6}
          mb={6}
          align="center"
        >
          <Text
            size="xs"
            c="dimmed"
            w={58}
          >
            source
          </Text>
          {sources.map(({ source: name, count }) => (
            <Badge
              key={name}
              variant={source === name ? "filled" : "outline"}
              color="gray"
              size="sm"
              style={{ cursor: "pointer" }}
              onClick={() => go("source", name)}
            >
              {name} {count}
            </Badge>
          ))}
        </Group>
      )}

      {reasons.length > 0 && (
        <Group
          gap={6}
          align="center"
        >
          <Text
            size="xs"
            c="dimmed"
            w={58}
          >
            blocked on
          </Text>
          {reasons.slice(0, VISIBLE).map(({ reason: value, count }) => {
            const { color, hint } = parseReviewReason(value);
            const active = reason === value;
            return (
              <Tooltip
                key={value}
                label={hint}
                withArrow
                multiline
                w={240}
              >
                <Badge
                  color={color}
                  variant={active ? "filled" : "light"}
                  size="sm"
                  style={{ cursor: "pointer" }}
                  onClick={() => go("reason", value)}
                >
                  {describeReviewReason(value)} · {count}
                </Badge>
              </Tooltip>
            );
          })}
          {reasons.length > VISIBLE && (
            <Text
              size="xs"
              c="dimmed"
            >
              +{reasons.length - VISIBLE} more
            </Text>
          )}
        </Group>
      )}
    </div>
  );
}
