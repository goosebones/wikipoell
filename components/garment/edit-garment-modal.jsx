"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Modal, Button, TextInput, Select, MultiSelect, NativeSelect,
  Stack, Title, ScrollArea, Text,
} from "@mantine/core";
import { useProperties } from "@/components/context/property-context-provider";
import CategoryTreeSelectClient from "@/components/category/category-tree-select-client";
import { ImageUpload } from "@/components/util/image-upload";

function propOptions(properties, key) {
  return properties
    .filter((p) => p.garmentKey === key)
    .map((p) => ({ value: p.garmentValue, label: p.description ?? p.garmentValue }));
}

export default function EditGarmentModal({ garment }) {
  const router = useRouter();
  const { properties } = useProperties();

  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [fields, setFields] = useState(null);

  function openModal() {
    // Initialise from current garment each time the modal opens
    setFields({
      title: garment.title ?? "",
      category: garment.category ?? null,
      type: garment.type ?? null,
      gender: garment.gender ?? null,
      model: garment.model ?? "",
      procedure: garment.procedure
        ? Array.isArray(garment.procedure) ? garment.procedure : [garment.procedure]
        : [],
      material: garment.material ?? null,
      process: garment.process ?? null,
      color: garment.color ?? null,
      source: garment.source ?? null,
      images: (garment.images ?? []).map((img) => ({
        id: crypto.randomUUID(),
        url: img.url,
        status: "done",
      })),
    });
    setError(null);
    setOpened(true);
  }

  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));
  const setSource = (k, v) => setFields((prev) => {
    const next = { ...(prev.source ?? {}), [k]: v || undefined };
    const hasAny = next.type || next.label || next.url;
    return { ...prev, source: hasAny ? next : null };
  });

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const images = fields.images.filter((img) => img.url).map((img) => ({ url: img.url }));
      const res = await fetch(`/api/garment/${garment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setOpened(false);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="xs" variant="outline" onClick={openModal}>Edit Garment</Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Edit Garment"
        size="lg"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {fields && (
          <Stack gap="md">
            <div>
              <Title order={5} mb={4}>Title</Title>
              <TextInput
                value={fields.title}
                onChange={(e) => { const v = e.currentTarget.value; set("title", v); }}
                placeholder="Garment title"
              />
            </div>

            <div>
              <Title order={5} mb={4}>Category</Title>
              <CategoryTreeSelectClient value={fields.category} onChange={(v) => set("category", v)} />
            </div>

            <div>
              <Title order={5} mb={4}>Type</Title>
              <Select
                placeholder="Select type"
                data={propOptions(properties, "type")}
                value={fields.type}
                onChange={(v) => set("type", v)}
                searchable clearable
              />
            </div>

            <div>
              <Title order={5} mb={4}>Gender</Title>
              <Select
                placeholder="Select gender"
                data={propOptions(properties, "gender")}
                value={fields.gender}
                onChange={(v) => set("gender", v)}
                searchable clearable
              />
            </div>

            <div>
              <Title order={5} mb={4}>Procedure</Title>
              <MultiSelect
                placeholder="Select procedure(s)"
                data={propOptions(properties, "procedure")}
                value={fields.procedure}
                onChange={(v) => set("procedure", v)}
                searchable clearable
              />
            </div>

            <div>
              <Title order={5} mb={4}>Material</Title>
              <Select
                placeholder="Select material"
                data={propOptions(properties, "material")}
                value={fields.material}
                onChange={(v) => set("material", v)}
                searchable clearable
              />
            </div>

            <div>
              <Title order={5} mb={4}>Process</Title>
              <Select
                placeholder="Select process"
                data={propOptions(properties, "process")}
                value={fields.process}
                onChange={(v) => set("process", v)}
                searchable clearable
              />
            </div>

            <div>
              <Title order={5} mb={4}>Color</Title>
              <Select
                placeholder="Select color"
                data={propOptions(properties, "color")}
                value={fields.color}
                onChange={(v) => set("color", v)}
                searchable clearable
              />
            </div>

            <div>
              <Title order={5} mb={4}>Model</Title>
              <TextInput
                placeholder="Model number"
                value={fields.model ?? ""}
                onChange={(e) => { const v = e.currentTarget.value; set("model", v); }}
              />
            </div>

            <div>
              <Title order={5} mb={4}>Source (optional)</Title>
              <NativeSelect
                mb="sm"
                data={[
                  { value: "", label: "Select source" },
                  { value: "me", label: "This is my own garment" },
                  { value: "external", label: "From someone/somewhere else" },
                ]}
                value={fields.source?.type ?? ""}
                onChange={(e) => setSource("type", e.currentTarget.value || undefined)}
              />
              {fields.source?.type === "external" && (
                <Stack gap="xs">
                  <TextInput
                    label="Name / Username / Title"
                    placeholder="e.g. Store, person, or account name"
                    value={fields.source?.label ?? ""}
                    onChange={(e) => { const v = e.currentTarget.value; setSource("label", v); }}
                  />
                  <TextInput
                    label="URL (optional)"
                    placeholder="https://..."
                    value={fields.source?.url ?? ""}
                    onChange={(e) => { const v = e.currentTarget.value; setSource("url", v); }}
                  />
                </Stack>
              )}
            </div>

            <div>
              <Title order={5} mb={4}>Images</Title>
              <ImageUpload
                garmentId={garment.imageGroupId}
                value={fields.images}
                onChange={(updater) =>
                  setFields((prev) => ({
                    ...prev,
                    images: typeof updater === "function" ? updater(prev.images) : updater,
                  }))
                }
              />
            </div>

            {error && <Text size="sm" c="red">{error}</Text>}

            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}
