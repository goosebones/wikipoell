import Garment from "@/models/Garment";

export const GARMENT_PATCH_FIELDS_OWNER = [
  "title",
  "category",
  "type",
  "gender",
  "model",
  "procedure",
  "material",
  "process",
  "color",
  "source",
  "images",
];

export const GARMENT_PATCH_FIELDS_ADMIN = [
  "status",
  ...GARMENT_PATCH_FIELDS_OWNER,
];

const VALID_STATUSES = ["pending", "published", "rejected"];

export function normalizeProcedure(procedure) {
  if (procedure == null || procedure === "") return null;
  if (typeof procedure === "string") {
    const t = procedure.trim();
    return t.length ? t : null;
  }
  if (Array.isArray(procedure)) {
    const cleaned = procedure
      .filter((p) => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean);
    if (cleaned.length === 0) return null;
    return cleaned.length === 1 ? cleaned[0] : cleaned;
  }
  return null;
}

export function buildGarmentUpdate(body, allowedFields) {
  const update = {};
  for (const field of allowedFields) {
    if (field in body) {
      update[field] =
        field === "procedure"
          ? normalizeProcedure(body.procedure)
          : (body[field] ?? null);
    }
  }
  return update;
}

/** @returns {{ error: string, status: number } | null} */
export function validateGarmentStatus(update) {
  if (update.status && !VALID_STATUSES.includes(update.status)) {
    return { error: "Invalid status", status: 400 };
  }
  return null;
}

/** @returns {Promise<object | null>} Plain serialized garment, or null if not found. */
export async function patchGarmentById(id, update) {
  const garment = await Garment.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true },
  );
  return garment ? JSON.parse(JSON.stringify(garment)) : null;
}
