import { Group, Button, Text } from "@mantine/core";
import { Check, X, Save } from "lucide-react";

export default function GarmentReviewActions({
  status,
  saving,
  saved,
  error,
  actioning,
  onPublish,
  onReject,
  onSave,
}) {
  return (
    <Group
      mt="xs"
      gap="xs"
      align="center"
    >
      <Button
        size="xs"
        color="green"
        leftSection={<Check size={13} />}
        loading={actioning === "published"}
        disabled={!!actioning || saving || status === "published"}
        onClick={onPublish}
      >
        Publish
      </Button>
      <Button
        size="xs"
        color="red"
        variant="outline"
        leftSection={<X size={13} />}
        loading={actioning === "rejected"}
        disabled={!!actioning || saving || status === "rejected"}
        onClick={onReject}
      >
        Reject
      </Button>
      <Button
        size="xs"
        variant="outline"
        color="gray"
        leftSection={<Save size={13} />}
        loading={saving}
        disabled={!!actioning}
        onClick={onSave}
      >
        Save
      </Button>
      {saved && (
        <Text
          size="xs"
          c="green"
        >
          Saved
        </Text>
      )}
      {error && (
        <Text
          size="xs"
          c="red"
        >
          {error}
        </Text>
      )}
    </Group>
  );
}
