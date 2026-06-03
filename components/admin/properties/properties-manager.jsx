"use client";

import { useMemo, useState } from "react";
import {
  Group,
  Button,
  TextInput,
  Text,
  Table,
  ActionIcon,
  Title,
  Badge,
  Modal,
  Stack,
} from "@mantine/core";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  CHECKED_GARMENT_PROPERTY_FIELDS,
  GARMENT_PROPERTY_KEY_LABEL,
} from "@/lib/admin-garment-properties";
import PropertyModal from "@/components/admin/shared/property-modal";

export default function PropertiesManager({ initialProperties }) {
  const [properties, setProperties] = useState(initialProperties);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState({
    open: false,
    mode: "create",
    property: null,
    garmentKey: "",
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.garmentValue, p.description, p.propertyName, p.propertyType, p.garmentKey]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [properties, query]);

  const grouped = useMemo(() => {
    const byKey = Object.fromEntries(
      CHECKED_GARMENT_PROPERTY_FIELDS.map((key) => [key, []]),
    );
    for (const p of filtered) {
      if (byKey[p.garmentKey]) byKey[p.garmentKey].push(p);
    }
    for (const key of CHECKED_GARMENT_PROPERTY_FIELDS) {
      byKey[key].sort((a, b) =>
        (a.description ?? a.garmentValue).localeCompare(
          b.description ?? b.garmentValue,
        ),
      );
    }
    return byKey;
  }, [filtered]);

  function upsertProperty(property) {
    setProperties((prev) => {
      const idx = prev.findIndex((p) => p._id === property._id);
      if (idx === -1) return [...prev, property];
      const next = [...prev];
      next[idx] = property;
      return next;
    });
  }

  function removeProperty(id) {
    setProperties((prev) => prev.filter((p) => p._id !== id));
  }

  function openCreate(garmentKey = "") {
    setModal({ open: true, mode: "create", property: null, garmentKey });
  }

  function openEdit(property) {
    setModal({
      open: true,
      mode: "edit",
      property,
      garmentKey: property.garmentKey,
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/admin/property/${encodeURIComponent(String(deleteTarget._id))}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      removeProperty(deleteTarget._id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Group
        justify="space-between"
        mb="md"
        align="flex-end"
      >
        <div>
          <Text
            size="sm"
            c="dimmed"
          >
            Valid values for garment type, gender, material, process, color, and
            procedure. Used in submission forms and admin review.
          </Text>
        </div>
        <Button
          size="xs"
          color="violet"
          leftSection={<Plus size={14} />}
          onClick={() => openCreate()}
        >
          Add property
        </Button>
      </Group>

      <TextInput
        size="xs"
        placeholder="Search values, labels, or names…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        mb="lg"
      />

      {CHECKED_GARMENT_PROPERTY_FIELDS.map((key) => {
        const rows = grouped[key];
        const label = GARMENT_PROPERTY_KEY_LABEL[key] ?? key;
        return (
          <div
            key={key}
            style={{ marginBottom: "1.5rem" }}
          >
            <Group
              mb="xs"
              gap="xs"
            >
              <Title order={4}>{label}</Title>
              <Badge
                size="sm"
                variant="light"
                color="gray"
              >
                {rows.length}
              </Badge>
              <Button
                size="compact-xs"
                variant="subtle"
                color="violet"
                leftSection={<Plus size={12} />}
                onClick={() => openCreate(key)}
              >
                Add
              </Button>
            </Group>
            {rows.length === 0 ? (
              <Text
                size="xs"
                c="dimmed"
              >
                No values yet.
              </Text>
            ) : (
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                fz="xs"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Label</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th w={80} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((p) => (
                    <Table.Tr key={p._id}>
                      <Table.Td>
                        <Text
                          size="xs"
                          ff="monospace"
                        >
                          {p.garmentValue}
                        </Text>
                      </Table.Td>
                      <Table.Td>{p.description ?? "—"}</Table.Td>
                      <Table.Td c="dimmed">{p.propertyName}</Table.Td>
                      <Table.Td>
                        <Group
                          gap={4}
                          justify="flex-end"
                          wrap="nowrap"
                        >
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="gray"
                            title="Edit"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            title="Delete"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </div>
        );
      })}

      <PropertyModal
        opened={modal.open}
        mode={modal.mode}
        property={modal.property}
        garmentKey={modal.garmentKey}
        onClose={() =>
          setModal({
            open: false,
            mode: "create",
            property: null,
            garmentKey: "",
          })
        }
        onSaved={upsertProperty}
      />

      <Modal
        opened={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        title="Delete property?"
        size="sm"
      >
        <Stack gap="sm">
          <Text size="sm">
            Remove{" "}
            <Text
              span
              fw={600}
            >
              {deleteTarget?.garmentValue}
            </Text>{" "}
            from {GARMENT_PROPERTY_KEY_LABEL[deleteTarget?.garmentKey] ?? deleteTarget?.garmentKey}?
            Existing garments keep this value but it will show as unknown in review.
          </Text>
          {deleteError && (
            <Text
              size="xs"
              c="red"
            >
              {deleteError}
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="default"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color="red"
              loading={deleting}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
