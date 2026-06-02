import { Button } from "@mantine/core";
import { ExternalLink } from "lucide-react";

export default function GarmentSourceLink({ source, px = 6 }) {
  if (!source?.url && !source?.label) return null;

  return (
    <a
      href={source.url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
    >
      <Button
        size="xs"
        variant="subtle"
        color="gray"
        px={px}
        leftSection={<ExternalLink size={11} />}
      >
        {source.label ?? "Source"}
      </Button>
    </a>
  );
}
