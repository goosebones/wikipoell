"use client";

import { useEffect, useState } from "react";
import { Modal, Stack, TextInput, Button, Text } from "@mantine/core";
import { GARMENT_PROPERTY_KEY_LABEL } from "@/lib/admin-garment-properties";

export default function AddPropertyModal({
  opened,
  garmentKey,
  garmentValue,
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState({
    propertyType: "",
    propertyName: "",
    garmentKey: "",
    garmentValue: "",
    description: "",
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
    const label = GARMENT_PROPERTY_KEY_LABEL[garmentKey] ?? garmentKey;
    setForm({
      propertyType: label,
      propertyName: "",
      garmentKey,
      garmentValue: garmentValue ?? "",
      description: "",
    });
    setError(null);
  }, [opened, garmentKey, garmentValue]);

  async function handleSubmit() {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create property");
      onCreated(data.property);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Property"
      size="sm"
    >
      <Stack gap="xs">
        <TextInput
          label="Property Type"
          size="xs"
          value={form.propertyType}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((f) => ({ ...f, propertyType: v }));
          }}
        />
        <TextInput
          label="Property Name"
          size="xs"
          value={form.propertyName}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((f) => ({ ...f, propertyName: v }));
          }}
        />
        <TextInput
          label="Garment Key"
          size="xs"
          value={form.garmentKey}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((f) => ({ ...f, garmentKey: v }));
          }}
        />
        <TextInput
          label="Garment Value"
          size="xs"
          value={form.garmentValue}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((f) => ({ ...f, garmentValue: v }));
          }}
        />
        <TextInput
          label="Description"
          size="xs"
          placeholder="Human-readable label (optional)"
          value={form.description}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((f) => ({ ...f, description: v }));
          }}
        />
        {error && (
          <Text
            size="xs"
            c="red"
          >
            {error}
          </Text>
        )}
        <Button
          size="xs"
          color="violet"
          loading={adding}
          onClick={handleSubmit}
        >
          Add Property
        </Button>
      </Stack>
    </Modal>
  );
}
