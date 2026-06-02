"use client";

import { useState } from "react";
import { Group, Badge } from "@mantine/core";
import AgentProposalCard from "@/components/admin/agent-proposal/agent-proposal-card";

const FILTERS = [
  { value: "all", label: "All", color: "blue" },
  { value: "pending", label: "pending", color: "yellow" },
  { value: "accepted", label: "accepted", color: "green" },
  { value: "skipped", label: "skipped", color: "gray" },
];

export default function AgentProposalList({ proposals, properties, categories }) {
  const [states, setStates] = useState(() =>
    Object.fromEntries(proposals.map((p) => [p._id, p.status ?? "pending"]))
  );
  const [filter, setFilter] = useState("all");

  const setCardState = (id, state) =>
    setStates((prev) => ({ ...prev, [id]: state }));

  const counts = Object.values(states).reduce(
    (acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; },
    {}
  );

  const visible = proposals.filter((p) => filter === "all" || states[p._id] === filter);

  return (
    <div>
      <Group mb="lg" gap="xs">
        {FILTERS.map(({ value, label, color }) => {
          const count = value === "all" ? proposals.length : (counts[value] ?? 0);
          const active = filter === value;
          return (
            <Badge
              key={value}
              color={color}
              variant={active ? "filled" : "light"}
              style={{ cursor: "pointer" }}
              onClick={() => setFilter(value)}
            >
              {count} {label}
            </Badge>
          );
        })}
      </Group>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {visible.map((proposal) => (
          <AgentProposalCard
            key={proposal._id}
            proposal={proposal}
            properties={properties}
            categories={categories}
            state={states[proposal._id]}
            onStateChange={(s) => setCardState(proposal._id, s)}
          />
        ))}
      </div>
    </div>
  );
}
