"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { useProperties } from "@/components/context/property-context-provider";
import CategoryTreeSelectClient from "@/components/category/category-tree-select-client";
import {
  Container,
  Title,
  Box,
  TextInput,
  Select,
  Button,
  Autocomplete,
} from "@mantine/core";
import { ImageUpload } from "@/components/util/image-upload";
import SignInPrompt from "@/components/sign-in-prompt";

export default function GarmentCreatePage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();

  const { properties } = useProperties();

  const [garmentData, setGarmentData] = useState({});
  const [garmentImageId] = useState(() => crypto.randomUUID());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const setGarmentDataField = (k, v) => {
    setGarmentData((prev) => ({
      ...prev,
      [k]: v,
    }));
  };

  const setSourceField = (field, value) => {
    setGarmentData((prev) => {
      const cleaned = value === "" || value == null ? undefined : value;
      const prevSource = prev.source || {};
      const nextSource = {
        ...prevSource,
        [field]: cleaned,
      };

      const hasAnyField = nextSource.type || nextSource.label || nextSource.url;

      return {
        ...prev,
        ...(hasAnyField ? { source: nextSource } : { source: undefined }),
      };
    });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);
    try {
      const images =
        (garmentData.images ?? [])
          .filter((img) => img?.url)
          .map((img) => ({ url: img.url })) || [];

      const rawSource = garmentData.source;
      let sourcePayload = null;
      if (rawSource?.type === "me") {
        sourcePayload = { type: "me" };
      } else if (rawSource?.type === "external") {
        const label =
          typeof rawSource.label === "string"
            ? rawSource.label.trim() || undefined
            : undefined;
        const url =
          typeof rawSource.url === "string"
            ? rawSource.url.trim() || undefined
            : undefined;

        if (label || url) {
          sourcePayload = {
            type: "external",
            ...(label && { label }),
            ...(url && { url }),
          };
        }
      }

      const { source: _omitSource, ...restGarmentData } = garmentData;
      const payload = {
        imageGroupId: garmentImageId,
        ...restGarmentData,
        ...(user?.id && { uploadedByUserId: user.id }),
        images,
        ...(sourcePayload && { source: sourcePayload }),
      };
      const res = await fetch("/api/garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save garment");
      }
      if (data.id) {
        router.push(`/garment/${data.id}`);
      } else {
        setSubmitSuccess("Garment saved");
      }
    } catch (err) {
      setSubmitError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSignedIn) {
    return <SignInPrompt>Please sign in to upload a garment</SignInPrompt>;
  }

  return (
    <Container>
      <Title
        order={1}
        py="md"
      >
        Upload Garment
      </Title>

      {/* category */}
      <Box py="sm">
        <Title order={3}>Category</Title>
        <CategoryTreeSelectClient
          value={garmentData.category}
          onChange={(v) => setGarmentDataField("category", v)}
        />
      </Box>

      {/* type selection */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Type
        </Title>
        <Select
          placeholder="Select type"
          data={properties
            .filter((p) => p.garmentKey === "type")
            .map((p) => ({
              value: p.garmentValue,
              label: p.description ?? p.garmentValue,
            }))}
          value={garmentData.type}
          searchable
          onChange={(v) => setGarmentDataField("type", v)}
        />
      </Box>

      {/* Gender selection */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Gender
        </Title>
        <Select
          placeholder="Select gender"
          data={properties
            .filter((p) => p.garmentKey === "gender")
            .map((p) => ({
              value: p.garmentValue,
              label: p.description ?? p.garmentValue,
            }))}
          value={garmentData.gender}
          searchable
          onChange={(v) => setGarmentDataField("gender", v)}
        />
      </Box>

      {/* Special procedure selection TODO ability to add multiple */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Procedures
        </Title>
        <Select
          placeholder="Select procedure"
          data={properties
            .filter((p) => p.garmentKey === "procedure")
            .map((p) => ({
              value: p.garmentValue,
              label: p.description ?? p.garmentValue,
            }))}
          value={garmentData.procedure}
          searchable
          onChange={(v) => setGarmentDataField("procedure", v)}
        />
      </Box>

      {/* Material selection */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Material
        </Title>
        <Select
          placeholder="Select material"
          data={properties
            .filter((p) => p.garmentKey === "material")
            .map((p) => ({
              value: p.garmentValue,
              label: p.description ?? p.garmentValue,
            }))}
          value={garmentData.material}
          searchable
          onChange={(v) => setGarmentDataField("material", v)}
        />
      </Box>
      {/* Process selection */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Process
        </Title>
        <Select
          placeholder="Select process"
          data={properties
            .filter((p) => p.garmentKey === "process")
            .map((p) => ({
              value: p.garmentValue,
              label: p.description ?? p.garmentValue,
            }))}
          value={garmentData.process}
          searchable
          onChange={(v) => setGarmentDataField("process", v)}
        />
      </Box>

      {/* Color selection */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Color
        </Title>
        <Select
          placeholder="Select color"
          data={properties
            .filter((p) => p.garmentKey === "color")
            .map((p) => ({
              value: p.garmentValue,
              label: p.description ?? p.garmentValue,
            }))}
          value={garmentData.color}
          searchable
          onChange={(v) => setGarmentDataField("color", v)}
        />
      </Box>

      {/* model & title selection */}
      <Box py="sm">
        <Title
          order={3}
          pb="xs"
        >
          Model &amp; Title
        </Title>
        <Autocomplete
          label="Model"
          placeholder="Select model"
          data={properties
            .filter((p) => p.garmentKey === "model")
            .map((p) => `${p.garmentValue} - ${p.propertyName}`)}
          value={garmentData.model}
          onChange={(v) => {
            const garmentValue = v.split(" - ")[0];
            const property = properties.find(
              (p) =>
                p.garmentKey === "model" && p.garmentValue === garmentValue,
            );
            console.log("property", property);
            if (property && property.propertyName) {
              setGarmentDataField("model", property.garmentValue);
              setGarmentDataField("title", property.propertyName);
            } else {
              setGarmentDataField("model", v);
            }
          }}
          className="mb-2"
        />
        <TextInput
          label="Title"
          placeholder="Scarstitch Leather Jacket"
          value={garmentData.title}
          onChange={(e) => setGarmentDataField("title", e.currentTarget.value)}
        />
      </Box>

      {/* Source (optional) TODO add option to choose me (current user) */}
      <Box py="sm">
        <Title
          order={3}
          className="pb-2"
        >
          Source (optional)
        </Title>
        <p className="text-sm text-muted-foreground mb-2">
          Where this garment is from — e.g. your own, a store, Instagram, or
          somewhere else online.
        </p>
        <Select
          placeholder="Select source"
          className="mb-4"
          data={[
            { value: "me", label: "This is my own garment" },
            { value: "external", label: "From someone/somewhere else" },
          ]}
          value={garmentData.source?.type ?? null}
          onChange={(v) => setSourceField("type", v ?? undefined)}
        />
        {garmentData.source?.type === "external" && (
          <>
            <TextInput
              label="Name / Username / Title"
              placeholder="e.g. Store, person, or account name"
              value={garmentData.source?.label ?? ""}
              onChange={(e) => setSourceField("label", e.currentTarget.value)}
              className="mb-4"
            />
            <TextInput
              label="URL (optional)"
              placeholder="https://..."
              value={garmentData.source?.url ?? ""}
              onChange={(e) => setSourceField("url", e.currentTarget.value)}
            />
          </>
        )}
      </Box>

      {/* Images selection */}
      <Box py="sm">
        <Title
          order={3}
          className="pb-2"
        >
          Images
        </Title>
        <ImageUpload
          garmentId={garmentImageId}
          value={garmentData.images}
          onChange={(updater) =>
            setGarmentData((prev) => ({
              ...prev,
              images:
                typeof updater === "function"
                  ? updater(prev.images ?? [])
                  : updater,
            }))
          }
        />
      </Box>

      {/* Submit */}
      <Box py="sm">
        {submitError && (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400">
            {submitError}
          </p>
        )}
        {submitSuccess && !submitError && (
          <p className="mb-2 text-sm text-emerald-600 dark:text-emerald-400">
            {submitSuccess}
          </p>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Submit"}
        </Button>
      </Box>
    </Container>
  );
}
