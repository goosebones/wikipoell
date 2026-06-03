"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Text,
  Select,
} from "@mantine/core";
import {
  GARMENT_PROPERTY_KEY_LABEL,
  CHECKED_GARMENT_PROPERTY_FIELDS,
} from "@/lib/admin-garment-properties";

const GARMENT_KEY_OPTIONS = CHECKED_GARMENT_PROPERTY_FIELDS.map((key) => ({
  value: key,
  label: GARMENT_PROPERTY_KEY_LABEL[key] ?? key,
}));

const emptyForm = {
  propertyType: "",
  propertyName: "",
  garmentKey: "",
  garmentValue: "",
  description: "",
};

export default function PropertyModal({
  opened,
  onClose,
  mode = "create",
  property = null,
  garmentKey: initialGarmentKey = "",
  garmentValue: initialGarmentValue = "",
  onSaved,
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
    if (mode === "edit" && property) {
      setForm({
        propertyType: property.propertyType ?? "",
        propertyName: property.propertyName ?? "",
        garmentKey: property.garmentKey ?? "",
        garmentValue: property.garmentValue ?? "",
        description: property.description ?? "",
      });
    } else {
      const key = initialGarmentKey || "";
      const label = GARMENT_PROPERTY_KEY_LABEL[key] ?? key;
      setForm({
        propertyType: label,
        propertyName: "",
        garmentKey: key,
        garmentValue: initialGarmentValue ?? "",
        description: "",
      });
    }
    setError(null);
  }, [opened, mode, property, initialGarmentKey, initialGarmentValue]);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const isEdit = mode === "edit" && property?._id;
      const url = isEdit
        ? `/api/admin/property/${encodeURIComponent(String(property._id))}`
        : "/api/admin/property";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      onSaved(data.property);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "edit" ? "Edit Property" : "Add Property";
  const submitLabel = mode === "edit" ? "Save Changes" : "Add Property";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <Stack gap="xs">
        <Select
          label="Garment field"
          size="xs"
          data={GARMENT_KEY_OPTIONS}
          value={form.garmentKey || null}
          onChange={(key) => {
            if (!key) return;
            const label = GARMENT_PROPERTY_KEY_LABEL[key] ?? key;
            setForm((f) => ({
              ...f,
              garmentKey: key,
              propertyType: f.propertyType || label,
            }));
          }}
        />
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
          label="Garment Value"
          size="xs"
          description="Value stored on garments (e.g. select option)"
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
          loading={saving}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
      </Stack>
    </Modal>
  );
}
