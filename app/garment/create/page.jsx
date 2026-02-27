"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

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
  const { isSignedIn } = useAuth();

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

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);
    try {
      const images =
        (garmentData.images ?? [])
          .filter((img) => img?.url)
          .map((img) => ({ url: img.url })) || [];

      const payload = {
        imageGroupId: garmentImageId,
        ...garmentData,
        images,
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
