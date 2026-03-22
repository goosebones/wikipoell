import { initMongo } from "./mongodb";
import Garment from "@/models/Garment";

export const getGarments = async (params = {}) => {
  const mongoQuery = {};

  // Handle other filters as $in queries on their respective fields
  Object.entries(params).forEach(([key, value]) => {
    if (key === "category") {
      const categoryValue = Array.isArray(params.category)
        ? params.category[0]
        : params.category;
      if (categoryValue) {
        mongoQuery.category = { $regex: `^${categoryValue}` };
      }
      return;
    }
    const valuesArray = Array.isArray(value) ? value : [value];
    // Ignore empty values
    const cleaned = valuesArray.filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (cleaned.length === 0) return;
    // Merge with existing field constraints if any
    if (mongoQuery[key.toLowerCase()]) {
      const existing = mongoQuery[key.toLowerCase()].$in || [];
      mongoQuery[key.toLowerCase()] = {
        $in: Array.from(new Set([...existing, ...cleaned])),
      };
    } else {
      mongoQuery[key.toLowerCase()] = { $in: cleaned };
    }
  });

  try {
    await initMongo();
    const garments = await Garment.find(mongoQuery);
    return JSON.parse(JSON.stringify(garments));
  } catch (error) {
    console.error("Error fetching garments:", error);
    throw new Error("Failed to fetch garments");
  }
};

export const getGarmentsByCategory = async (category) => {
  return await getGarments({ category: { $regex: `^${category}` } });
};

export const getGarmentById = async (id) => {
  try {
    await initMongo();
    const garment = await Garment.findById(id);
    if (!garment) return null;
    return JSON.parse(JSON.stringify(garment));
  } catch (error) {
    console.error("Error fetching garment by id:", error);
    throw new Error("Failed to fetch garment by id");
  }
};

export const getGarmentsByUserId = async (uploadedByUserId) => {
  if (!uploadedByUserId) return [];
  try {
    await initMongo();
    const garments = await Garment.find({ uploadedByUserId }).sort({
      createdAt: -1,
    });
    return JSON.parse(JSON.stringify(garments));
  } catch (error) {
    console.error("Error fetching garments by user:", error);
    throw new Error("Failed to fetch garments");
  }
};

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
