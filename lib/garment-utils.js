/**
 * Pure helpers for garments. This module must NOT import any server-only
 * code (Mongoose, MongoDB driver, etc.) so it can be safely used from
 * client components.
 */

/** @param {string | string[] | null | undefined} procedure */
function procedureCodeSuffix(procedure) {
  if (procedure == null || procedure === "") return "";
  if (Array.isArray(procedure)) {
    const parts = procedure.filter(
      (p) => typeof p === "string" && p.length > 0,
    );
    return parts.length ? `-${parts.join("-")}` : "";
  }
  return `-${procedure}`;
}

export const getGarmentCode = (garment) => {
  const garmentCodeLine1 = `${garment.type}${garment.gender}/${garment.model}${procedureCodeSuffix(garment.procedure)}`;
  const garmentCodeLine2 = `${garment.material}${garment.process ? "-" + garment.process : ""}/${garment.color}`;
  return {
    line1: garmentCodeLine1,
    line2: garmentCodeLine2,
  };
};

export const getOrderedGarmentPropertyList = () => {
  return [
    "type",
    "gender",
    "model",
    "procedure",
    "material",
    "process",
    "color",
  ];
};
