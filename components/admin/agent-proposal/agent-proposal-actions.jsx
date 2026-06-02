import { Group, Button } from "@mantine/core";
import { Check, X } from "lucide-react";

export default function AgentProposalActions({
  applying,
  onAccept,
  onSkip,
}) {
  return (
    <Group
      gap="xs"
      mt={6}
    >
      <Button
        size="xs"
        color="green"
        leftSection={<Check size={12} />}
        loading={applying}
        onClick={onAccept}
      >
        Accept
      </Button>
      <Button
        size="xs"
        variant="outline"
        color="gray"
        leftSection={<X size={12} />}
        disabled={applying}
        onClick={onSkip}
      >
        Skip
      </Button>
    </Group>
  );
}
