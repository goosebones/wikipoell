import { ActionIcon } from "@mantine/core";
import { Plus } from "lucide-react";

export default function FieldWithAdd({
  garmentKey,
  unknownValues,
  onAdd,
  children,
}) {
  if (unknownValues.length === 0) return children;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
      <div style={{ flex: 1 }}>{children}</div>
      <ActionIcon
        size="sm"
        variant="light"
        color="violet"
        mb={unknownValues.length ? 20 : 4}
        title={`Add "${unknownValues[0]}" to ${garmentKey} properties`}
        onClick={() => onAdd(garmentKey, unknownValues[0])}
      >
        <Plus size={12} />
      </ActionIcon>
    </div>
  );
}
