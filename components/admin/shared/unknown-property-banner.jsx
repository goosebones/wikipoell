import { Group, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";

export default function UnknownPropertyBanner({ unknownFields }) {
  if (unknownFields.length === 0) return null;

  return (
    <Group
      gap={6}
      wrap="nowrap"
      style={{
        background: "#f3e8ff",
        border: "1.5px solid #a855f7",
        borderRadius: 6,
        padding: "4px 10px",
      }}
    >
      <AlertTriangle
        size={15}
        color="#9333ea"
      />
      <Text
        size="sm"
        fw={600}
        c="#7e22ce"
        lineClamp={1}
      >
        {unknownFields.map((u) => `${u.field}: "${u.value}"`).join(", ")}
      </Text>
    </Group>
  );
}
