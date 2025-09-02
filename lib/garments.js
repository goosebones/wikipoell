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
  try {
    await initMongo();
    const garments = await Garment.find(params);
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
  console.log("id", id);
  try {
    await initMongo();
    const garment = await Garment.findById(id);
    return JSON.parse(JSON.stringify(garment));
  } catch (error) {
    console.error("Error fetching garment by id:", error);
    throw new Error("Failed to fetch garment by id");
  }
};
