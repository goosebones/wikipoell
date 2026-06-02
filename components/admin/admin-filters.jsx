"use client";

import { TextInput, Group } from "@mantine/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export default function AdminFilters({ title, id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key, value) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => router.push(`/admin?${params.toString()}`));
    },
    [router, searchParams],
  );

  return (
    <Group
      mb="md"
      gap="sm"
    >
      <TextInput
        size="xs"
        placeholder="Search by title…"
        defaultValue={title}
        style={{ width: 220 }}
        onChange={(e) => update("title", e.currentTarget.value)}
      />
      <TextInput
        size="xs"
        placeholder="Garment ID…"
        defaultValue={id}
        style={{ width: 220 }}
        onChange={(e) => update("id", e.currentTarget.value)}
      />
    </Group>
  );
}
