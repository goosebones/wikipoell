"use client";

import { useState } from "react";
import { Card, Group, Badge, Button, Text, Collapse } from "@mantine/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getGarmentCode } from "@/lib/garment-utils";
import {
  agentConfidenceColor,
  getChangedGarmentFields,
} from "@/lib/admin-garment-properties";
import GarmentImageStrip from "@/components/admin/shared/garment-image-strip";
import GarmentFieldGrid from "@/components/admin/shared/garment-field-grid";
import GarmentSourceLink from "@/components/admin/shared/garment-source-link";
import ProposalDiffTable from "@/components/admin/agent-proposal/proposal-diff-table";
import AgentProposalActions from "@/components/admin/agent-proposal/agent-proposal-actions";

export default function AgentProposalCard({
  proposal,
  properties,
  categories: _categories,
  state,
  onStateChange,
}) {
  const {
    _id: proposalId,
    garmentId,
    before,
    proposal: proposed,
    images: proposalImages,
    source,
  } = proposal;
  const { line1, line2 } = getGarmentCode(before);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    ...proposed,
    procedure: Array.isArray(proposed.procedure)
      ? proposed.procedure
      : proposed.procedure
        ? [proposed.procedure]
        : [],
  });
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const changedFields = getChangedGarmentFields(before, proposed);
  const images = (proposal.images || []).slice(0, 3);

  async function handleAccept() {
    setApplying(true);
    setError(null);
    try {
      const { confidence, notes, ...update } = fields;

      const res = await fetch(`/api/admin/garment/${garmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...update, status: "published" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      await fetch("/api/admin/agent-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garmentId,
          before,
          agentProposed: proposed,
          accepted: update,
          images: proposalImages || [],
        }),
      });

      await fetch(`/api/admin/agent-proposal/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });

      onStateChange("accepted");
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  }

  async function handleSkip() {
    await fetch(`/api/admin/agent-proposal/${proposalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    onStateChange("skipped");
  }

  return (
    <Card
      withBorder
      shadow="sm"
      p="sm"
      style={{ opacity: state === "skipped" ? 0.45 : 1 }}
    >
      <Group
        align="flex-start"
        wrap="nowrap"
        gap="sm"
      >
        <GarmentImageStrip
          images={images}
          size="sm"
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Group
            justify="space-between"
            mb={2}
            wrap="nowrap"
          >
            <Text
              size="sm"
              fw={600}
              lineClamp={1}
            >
              {fields.title}
            </Text>
            <Group
              gap={6}
              wrap="nowrap"
            >
              <Badge
                size="xs"
                color={agentConfidenceColor(proposed.confidence)}
                variant="light"
              >
                {Math.round(proposed.confidence * 100)}% confidence
              </Badge>
              {state === "accepted" && (
                <Badge
                  size="xs"
                  color="green"
                >
                  Accepted
                </Badge>
              )}
              {state === "skipped" && (
                <Badge
                  size="xs"
                  color="gray"
                >
                  Skipped
                </Badge>
              )}
            </Group>
          </Group>

          <Group
            gap="xs"
            mb={4}
            align="center"
          >
            <Text
              size="xs"
              c="dimmed"
            >
              {line1} · {line2}
            </Text>
            <GarmentSourceLink
              source={source}
              px={4}
            />
          </Group>

          <ProposalDiffTable
            before={before}
            after={proposed}
            changedFields={changedFields}
          />

          {proposed.notes && (
            <Text
              size="xs"
              c="dimmed"
              mb={6}
              lineClamp={editing ? undefined : 2}
            >
              {proposed.notes}
            </Text>
          )}

          {state === "pending" && (
            <>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                px={4}
                mb={4}
                leftSection={
                  editing ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                }
                onClick={() => setEditing((e) => !e)}
              >
                {editing ? "Hide fields" : "Edit before accepting"}
              </Button>

              <Collapse in={editing}>
                <GarmentFieldGrid
                  fields={fields}
                  set={set}
                  properties={properties}
                  mt={4}
                />
              </Collapse>
            </>
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

          {state === "pending" && (
            <AgentProposalActions
              applying={applying}
              onAccept={handleAccept}
              onSkip={handleSkip}
            />
          )}
        </div>
      </Group>
    </Card>
  );
}
