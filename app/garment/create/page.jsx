"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

import { Section, Heading, Container, Flex } from "@radix-ui/themes";
import { useProperties } from "@/components/context/property-context-provider";
import CategoryTreeSelectClient from "@/components/category/category-tree-select-client";
import { GuntherSelect } from "@/components/util/select";
import { GuntherCombobox } from "@/components/util/combobox";
import { GuntherInput } from "@/components/util/input";
import { ImageUpload } from "@/components/util/image-upload";
import { Button } from "@/styles/components/ui/button";
import SignInPrompt from "@/components/sign-in-prompt";

export default function GarmentCreatePage() {
  const { isSignedIn, user } = useUser();

  const { properties } = useProperties();

  const [garmentData, setGarmentData] = useState({});
  const [garmentImageId] = useState(() => crypto.randomUUID());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const setGarmentDataField = (k, v) => {
    const newGarmentData = { ...garmentData };
    newGarmentData[k] = v;
    setGarmentData(newGarmentData);
  };

  const setSourceField = (field, value) => {
    setGarmentData((prev) => ({
      ...prev,
      source: {
        ...(prev.source || {}),
        [field]: value === "" || value == null ? undefined : value,
      },
    }));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);
    try {
      setGarmentDataField("uploadedByUserId", user.id);
      const images =
        (garmentData.images ?? [])
          .filter((img) => img?.url)
          .map((img) => ({ url: img.url })) || [];

      const rawSource = garmentData.source;
      let sourcePayload = null;
      if (rawSource?.type) {
        const displayName =
          typeof rawSource.displayName === "string"
            ? rawSource.displayName.trim()
            : undefined;
        if (rawSource.type === "instagram" && displayName) {
          const handle = displayName.replace(/^@/, "");
          sourcePayload = {
            type: "instagram",
            displayName: handle,
            url: `https://instagram.com/${encodeURIComponent(handle)}`,
          };
        } else if (
          rawSource.type === "website" ||
          rawSource.type === "name" ||
          rawSource.type === "other"
        ) {
          sourcePayload = {
            type: rawSource.type,
            displayName: displayName || undefined,
            url:
              typeof rawSource.url === "string"
                ? rawSource.url.trim() || undefined
                : undefined,
            platform:
              rawSource.type === "other" &&
              typeof rawSource.platform === "string"
                ? rawSource.platform.trim() || undefined
                : undefined,
          };
        } else if (rawSource.type === "user" && displayName) {
          sourcePayload = { type: "user", displayName };
        }
      }

      const { source: _omitSource, ...restGarmentData } = garmentData;
      const payload = {
        imageGroupId: garmentImageId,
        ...restGarmentData,
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
      setSubmitSuccess("Garment saved");
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
      <Section size="1">
        <Heading size="7">Upload Garment</Heading>
      </Section>
      {/* category */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Category
        </Heading>
        <CategoryTreeSelectClient
          value={garmentData["category"]}
          onChange={(v) => setGarmentDataField("category", v)}
        />
      </Section>
      {/* type selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Type
        </Heading>
        <GuntherSelect
          items={properties.filter((p) => p.garmentKey === "type")}
          itemValue="garmentValue"
          itemTitle="description"
          placeholder="Select type"
          onSelect={(v) => setGarmentDataField("type", v)}
        />
      </Section>
      {/* Gender selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Gender
        </Heading>
        <GuntherSelect
          items={properties.filter((p) => p.garmentKey === "gender")}
          itemValue="garmentValue"
          itemTitle="description"
          placeholder="Select gender"
          onSelect={(v) => setGarmentDataField("gender", v)}
        />
      </Section>
      {/* Special procedure selection TODO ability to add multiple */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Procedures
        </Heading>
        <GuntherCombobox
          items={properties.filter((p) => p.garmentKey === "procedure")}
          itemValue="garmentValue"
          itemTitle="description"
          placeholder="Select procedure"
          onSelect={(v) => setGarmentDataField("procedure", v)}
        />
      </Section>
      {/* Material selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Material
        </Heading>
        <GuntherCombobox
          items={properties.filter((p) => p.garmentKey === "material")}
          itemValue="garmentValue"
          itemTitle="description"
          placeholder="Select material"
          onSelect={(v) => setGarmentDataField("material", v)}
        />
      </Section>
      {/* Process selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Process
        </Heading>
        <GuntherSelect
          items={properties.filter((p) => p.garmentKey === "process")}
          itemValue="garmentValue"
          itemTitle="description"
          placeholder="Select process"
          onSelect={(v) => setGarmentDataField("process", v)}
        />
      </Section>
      {/* Color selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Color
        </Heading>
        <GuntherCombobox
          items={properties.filter((p) => p.garmentKey === "color")}
          itemValue="garmentValue"
          itemTitle="description"
          placeholder="Select color"
          onSelect={(v) => setGarmentDataField("color", v)}
        />
      </Section>
      {/* Title & model selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Title & Model
        </Heading>
        <GuntherInput
          label="Title"
          placeholder="Scarstitch Leather Jacket"
          onChange={(v) => setGarmentDataField("title", v)}
          className="mb-4"
        />
        <GuntherInput
          label="Model Number"
          placeholder="2498"
          onChange={(v) => setGarmentDataField("model", v)}
        />
      </Section>
      {/* Source (optional) TODO add option to choose me (current user) */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Source (optional)
        </Heading>
        <p className="text-sm text-muted-foreground mb-2">
          Where this garment is from — e.g. another user, a store, Instagram, or
          somewhere else online.
        </p>
        <GuntherCombobox
          items={[
            { value: "user", label: "Another user on this site" },
            { value: "website", label: "Retailer / Website" },
            { value: "instagram", label: "Instagram" },
            { value: "name", label: "Name only" },
            { value: "other", label: "Other" },
          ]}
          itemValue="value"
          itemTitle="label"
          placeholder="Select source"
          onSelect={(v) => setSourceField("type", v)}
          className="mb-4"
        />
        {/* TODO add user selection to query list of users */}
        {garmentData.source?.type === "user" && (
          <GuntherInput
            label="Username"
            placeholder="username"
            onChange={(v) => setSourceField("displayName", v)}
          />
        )}
        {garmentData.source?.type === "website" && (
          <>
            <GuntherInput
              label="Name"
              placeholder="Retailer or website name"
              onChange={(v) => setSourceField("displayName", v)}
              className="mb-4"
            />
            <GuntherInput
              label="URL"
              placeholder="https://..."
              onChange={(v) => setSourceField("url", v)}
            />
          </>
        )}
        {/* TODO add verification this person is actually on instagram */}
        {garmentData.source?.type === "instagram" && (
          <GuntherInput
            label="Handle"
            placeholder="carolchristianpoell"
            prepend="@"
            onChange={(v) => setSourceField("displayName", v)}
          />
        )}
        {garmentData.source?.type === "name" && (
          <GuntherInput
            label="Name"
            placeholder="Person or place name"
            onChange={(v) => setSourceField("displayName", v)}
          />
        )}
        {garmentData.source?.type === "other" && (
          <>
            <GuntherInput
              label="Name"
              placeholder="Display name"
              onChange={(v) => setSourceField("displayName", v)}
              className="mb-4"
            />
            <GuntherInput
              label="URL (optional)"
              placeholder="https://..."
              onChange={(v) => setSourceField("url", v)}
              className="mb-4"
            />
            <GuntherInput
              label="Platform (optional)"
              placeholder="e.g. Etsy, Depop"
              onChange={(v) => setSourceField("platform", v)}
            />
          </>
        )}
      </Section>

      {/* Images selection */}
      <Section size="1">
        <Heading
          size="5"
          className="pb-2"
        >
          Images
        </Heading>
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
      </Section>

      {/* Submit */}
      <Section size="1">
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
      </Section>
    </Container>
  );
}
