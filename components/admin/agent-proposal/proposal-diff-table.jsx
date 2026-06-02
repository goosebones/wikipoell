import { Text } from "@mantine/core";

function DiffRow({ label, before, after }) {
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (!changed) return null;
  const fmt = (v) => (Array.isArray(v) ? v.join(", ") : (v ?? "—"));
  return (
    <tr>
      <td
        style={{
          padding: "2px 8px 2px 0",
          fontSize: 12,
          color: "#888",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "2px 8px",
          fontSize: 12,
          color: "#e03131",
          textDecoration: "line-through",
        }}
      >
        {fmt(before)}
      </td>
      <td
        style={{
          padding: "2px 4px",
          fontSize: 12,
          color: "#2f9e44",
          fontWeight: 600,
        }}
      >
        {fmt(after)}
      </td>
    </tr>
  );
}

export default function ProposalDiffTable({ before, after, changedFields }) {
  if (changedFields.length === 0) {
    return (
      <Text
        size="xs"
        c="dimmed"
      >
        No changes proposed.
      </Text>
    );
  }

  return (
    <table style={{ borderCollapse: "collapse", marginBottom: 6 }}>
      <tbody>
        {changedFields.map((f) => (
          <DiffRow
            key={f}
            label={f}
            before={before[f] ?? null}
            after={after[f] ?? null}
          />
        ))}
      </tbody>
    </table>
  );
}
