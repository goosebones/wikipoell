export const GARMENT_STATUS_COLORS = {
  pending: "yellow",
  published: "green",
  rejected: "red",
};

export const GARMENT_PROPERTY_KEY_LABEL = {
  type: "Type",
  gender: "Gender",
  material: "Material",
  process: "Process",
  color: "Color",
  procedure: "Procedure",
};

export const CHECKED_GARMENT_PROPERTY_FIELDS = [
  "type",
  "gender",
  "material",
  "process",
  "color",
  "procedure",
];

export const GARMENT_EDIT_FIELDS = [
  "title",
  "category",
  "type",
  "gender",
  "model",
  "procedure",
  "material",
  "process",
  "color",
];

export function getChangedGarmentFields(before, after, fields = GARMENT_EDIT_FIELDS) {
  return fields.filter(
    (f) =>
      JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null),
  );
}

export function agentConfidenceColor(confidence) {
  if (confidence >= 0.85) return "green";
  if (confidence >= 0.7) return "yellow";
  return "orange";
}

export function formatGarmentTitle(title) {
  return title
    .toLowerCase()
    .replace(/(^|[\s\-.])\w/g, (m) => m.toUpperCase());
}

export function propOptions(properties, key) {
  return properties
    .filter((p) => p.garmentKey === key)
    .map((p) => ({
      value: p.garmentValue,
      label: p.description ?? p.garmentValue,
    }));
}

export function unknownValuesFor(fields, properties, key) {
  const known = new Set(
    properties
      .filter((p) => p.garmentKey === key)
      .map((p) => p.garmentValue),
  );
  const val = fields[key];
  if (!val) return [];
  return (Array.isArray(val) ? val : [val]).filter((v) => v && !known.has(v));
}

export function collectUnknownFields(fields, properties) {
  return CHECKED_GARMENT_PROPERTY_FIELDS.flatMap((key) =>
    unknownValuesFor(fields, properties, key).map((value) => ({
      field: key,
      value,
    })),
  );
}
