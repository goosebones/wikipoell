"use client";

import { Group, Button, Select } from "@mantine/core";
import { useRouter } from "next/navigation";

export default function AdminPagination({
  page,
  totalPages,
  status,
  title,
  id,
}) {
  const router = useRouter();
  const go = (p) => {
    const params = new URLSearchParams({ status, page: p });
    if (title) params.set("title", title);
    if (id) params.set("id", id);
    router.push(`/admin?${params.toString()}`);
  };

  const pageOptions = Array.from({ length: totalPages }, (_, i) => ({
    value: String(i + 1),
    label: `Page ${i + 1}`,
  }));

  return (
    <Group
      mt="lg"
      justify="center"
      align="center"
    >
      <Button
        size="xs"
        variant="outline"
        color="gray"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        Previous
      </Button>
      <Select
        size="xs"
        data={pageOptions}
        value={String(page)}
        onChange={(v) => v && go(Number(v))}
        style={{ width: 110 }}
        allowDeselect={false}
      />
      <span>of {totalPages}</span>
      <Button
        size="xs"
        variant="outline"
        color="gray"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
      >
        Next
      </Button>
    </Group>
  );
}
