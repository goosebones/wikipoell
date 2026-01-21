import { Schema, model, models, Types } from "mongoose";
import { initMongo } from "./mongodb";

const garmentSchema = new Schema({
  _id: {
    type: Types.ObjectId,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  material: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  images: {
    type: [String],
    required: false,
  },
});
export const Garment = models.Garment || model("Garment", garmentSchema);

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
      (v) => typeof v === "string" && v.length > 0
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
    return JSON.parse(JSON.stringify(garment));
  } catch (error) {
    console.error("Error fetching garment by id:", error);
    throw new Error("Failed to fetch garment by id");
  }
};
