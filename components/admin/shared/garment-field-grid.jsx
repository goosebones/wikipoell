import {
  Grid,
  Group,
  Button,
  TextInput,
  Select,
  MultiSelect,
  Text,
} from "@mantine/core";
import CategoryTreeSelectClient from "@/components/category/category-tree-select-client";
import { propOptions, unknownValuesFor } from "@/lib/admin-garment-properties";
import FieldWithAdd from "@/components/admin/shared/field-with-add";

function propertyFieldError(garmentKey, fieldValue, unknown) {
  if (!unknown.length) return null;
  if (garmentKey === "procedure") {
    return unknown.map((v) => `"${v}"`).join(", ") + " unknown";
  }
  return `"${fieldValue}" unknown`;
}

export default function GarmentFieldGrid({
  fields,
  set,
  properties,
  formatTitle,
  onAddProperty,
  showCategoryWarning = false,
  mt,
}) {
  const reviewMode = !!onAddProperty;
  const unknownFor = (key) =>
    reviewMode ? unknownValuesFor(fields, properties, key) : [];

  function wrapPropertyField(garmentKey, field) {
    if (!reviewMode) return field;
    return (
      <FieldWithAdd
        garmentKey={garmentKey}
        unknownValues={unknownFor(garmentKey)}
        onAdd={onAddProperty}
      >
        {field}
      </FieldWithAdd>
    );
  }

  return (
    <Grid
      gutter="xs"
      mt={mt}
    >
      {formatTitle ? (
        <>
          <Grid.Col span={11}>
            <TextInput
              size="xs"
              label="Title"
              value={fields.title ?? ""}
              onChange={(e) => set("title", e.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col
            span={1}
            style={{ display: "flex", alignItems: "flex-end" }}
          >
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              px={6}
              onClick={formatTitle}
              title="Convert to title case"
            >
              Aa
            </Button>
          </Grid.Col>
        </>
      ) : (
        <Grid.Col span={12}>
          <TextInput
            size="xs"
            label="Title"
            value={fields.title ?? ""}
            onChange={(e) => set("title", e.currentTarget.value)}
          />
        </Grid.Col>
      )}

      <Grid.Col span={12}>
        {showCategoryWarning ? (
          <Group
            gap={6}
            mb={2}
            align="center"
          >
            <Text
              size="xs"
              fw={500}
            >
              Category
            </Text>
            {(!fields.category || !fields.category.includes(".")) && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#7e22ce",
                  background: "#f3e8ff",
                  border: "1px solid #a855f7",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                {fields.category ? "1 level" : "no category"}
              </span>
            )}
          </Group>
        ) : (
          <Text
            size="xs"
            fw={500}
            mb={2}
          >
            Category
          </Text>
        )}
        <CategoryTreeSelectClient
          value={fields.category}
          onChange={(v) => set("category", v)}
        />
      </Grid.Col>

      <Grid.Col span={3}>
        {wrapPropertyField(
          "type",
          <Select
            size="xs"
            label="Type"
            data={propOptions(properties, "type")}
            value={fields.type}
            onChange={(v) => set("type", v)}
            clearable
            searchable
            error={propertyFieldError("type", fields.type, unknownFor("type"))}
          />,
        )}
      </Grid.Col>
      <Grid.Col span={3}>
        {wrapPropertyField(
          "gender",
          <Select
            size="xs"
            label="Gender"
            data={propOptions(properties, "gender")}
            value={fields.gender}
            onChange={(v) => set("gender", v)}
            clearable
            searchable
            error={propertyFieldError(
              "gender",
              fields.gender,
              unknownFor("gender"),
            )}
          />,
        )}
      </Grid.Col>
      <Grid.Col span={3}>
        <TextInput
          size="xs"
          label="Model"
          value={fields.model ?? ""}
          onChange={(e) => set("model", e.currentTarget.value)}
        />
      </Grid.Col>
      <Grid.Col span={3}>
        {wrapPropertyField(
          "procedure",
          <MultiSelect
            size="xs"
            label="Procedure"
            data={propOptions(properties, "procedure")}
            value={fields.procedure}
            onChange={(v) => set("procedure", v)}
            clearable
            searchable
            error={propertyFieldError(
              "procedure",
              fields.procedure,
              unknownFor("procedure"),
            )}
          />,
        )}
      </Grid.Col>
      <Grid.Col span={4}>
        {wrapPropertyField(
          "material",
          <Select
            size="xs"
            label="Material"
            data={propOptions(properties, "material")}
            value={fields.material}
            onChange={(v) => set("material", v)}
            clearable
            searchable
            error={propertyFieldError(
              "material",
              fields.material,
              unknownFor("material"),
            )}
          />,
        )}
      </Grid.Col>
      <Grid.Col span={4}>
        {wrapPropertyField(
          "process",
          <Select
            size="xs"
            label="Process"
            data={propOptions(properties, "process")}
            value={fields.process}
            onChange={(v) => set("process", v)}
            clearable
            searchable
            error={propertyFieldError(
              "process",
              fields.process,
              unknownFor("process"),
            )}
          />,
        )}
      </Grid.Col>
      <Grid.Col span={4}>
        {wrapPropertyField(
          "color",
          <Select
            size="xs"
            label="Color"
            data={propOptions(properties, "color")}
            value={fields.color}
            onChange={(v) => set("color", v)}
            clearable
            searchable
            error={propertyFieldError(
              "color",
              fields.color,
              unknownFor("color"),
            )}
          />,
        )}
      </Grid.Col>
    </Grid>
  );
}
