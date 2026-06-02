"use client";

import { useState } from "react";
import { Card, Group, Badge, Text } from "@mantine/core";
import { getGarmentCode } from "@/lib/garment-utils";
import {
  GARMENT_STATUS_COLORS,
  collectUnknownFields,
  formatGarmentTitle,
} from "@/lib/admin-garment-properties";
import GarmentImageStrip from "@/components/admin/shared/garment-image-strip";
import GarmentFieldGrid from "@/components/admin/shared/garment-field-grid";
import GarmentSourceLink from "@/components/admin/shared/garment-source-link";
import UnknownPropertyBanner from "@/components/admin/shared/unknown-property-banner";
import GarmentReviewActions from "@/components/admin/garment-review/garment-review-actions";
import ImageLightboxModal from "@/components/admin/garment-review/image-lightbox-modal";
import AddPropertyModal from "@/components/admin/garment-review/add-property-modal";

export default function GarmentReviewCard({ garment, properties }) {
  const [localProperties, setLocalProperties] = useState(properties);
  const [addModal, setAddModal] = useState({
    open: false,
    garmentKey: "",
    garmentValue: "",
  });

  const [fields, setFields] = useState({
    title: garment.title ?? "",
    category: garment.category ?? null,
    type: garment.type ?? null,
    gender: garment.gender ?? null,
    model: garment.model ?? "",
    procedure: garment.procedure
      ? Array.isArray(garment.procedure)
        ? garment.procedure
        : [garment.procedure]
      : [],
    material: garment.material ?? null,
    process: garment.process ?? null,
    color: garment.color ?? null,
    images: garment.images ?? [],
  });
  const [status, setStatus] = useState(garment.status);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [error, setError] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const unknownFields = collectUnknownFields(fields, localProperties);

  async function patch(body) {
    const res = await fetch(`/api/admin/garment/${garment._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Request failed");
    return res.json();
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await patch(fields);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(newStatus) {
    setActioning(newStatus);
    setError(null);
    try {
      await patch({ ...fields, status: newStatus });
      setStatus(newStatus);
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  }

  function openAddProperty(garmentKey, garmentValue) {
    setAddModal({ open: true, garmentKey, garmentValue });
  }

  const { line1, line2 } = getGarmentCode(garment);

  function formatTitle() {
    set("title", formatGarmentTitle(fields.title));
  }

  return (
    <>
      <Card
        withBorder
        shadow="sm"
        p="sm"
      >
        <GarmentImageStrip
          images={fields.images}
          size="lg"
          draggable
          showCoverBadge
          caption="Images — drag to reorder"
          onReorder={(next) => set("images", next)}
          onImageClick={setLightboxUrl}
        />

        <Group
          justify="space-between"
          mb={6}
          wrap="nowrap"
        >
          <Group
            gap="xs"
            align="center"
          >
            <Badge
              color={GARMENT_STATUS_COLORS[status]}
              variant="light"
              size="sm"
            >
              {status}
            </Badge>
            <Text
              size="xs"
              c="dimmed"
            >
              {line1} · {line2}
            </Text>
            <GarmentSourceLink source={garment.source} />
          </Group>
          <UnknownPropertyBanner unknownFields={unknownFields} />
        </Group>

        <GarmentFieldGrid
          fields={fields}
          set={set}
          properties={localProperties}
          onAddProperty={openAddProperty}
          formatTitle={formatTitle}
          showCategoryWarning
        />

        <GarmentReviewActions
          status={status}
          saving={saving}
          saved={saved}
          error={error}
          actioning={actioning}
          onPublish={() => handleAction("published")}
          onReject={() => handleAction("rejected")}
          onSave={handleSave}
        />
      </Card>

      <ImageLightboxModal
        url={lightboxUrl}
        onClose={() => setLightboxUrl(null)}
      />

      <AddPropertyModal
        opened={addModal.open}
        garmentKey={addModal.garmentKey}
        garmentValue={addModal.garmentValue}
        onClose={() =>
          setAddModal({ open: false, garmentKey: "", garmentValue: "" })
        }
        onCreated={(property) =>
          setLocalProperties((prev) => [...prev, property])
        }
      />
    </>
  );
}
