import { Schema, model, models } from "mongoose";
import { cache } from "react";
import { initMongo } from "./mongodb";

const propertySchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  propertyType: {
    type: String,
    required: true,
  },
  propertyName: {
    type: String,
    required: true,
  },
  garmentKey: {
    type: String,
    required: true,
  },
  garmentValue: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
});
export const Property = models.Property || model("Property", propertySchema);

export const getProperties = cache(async () => {
  try {
    await initMongo();
    const properties = await Property.find({}).sort({ description: 1 });
    return JSON.parse(JSON.stringify(properties));
  } catch (error) {
    console.error("Error fetching properties:", error);
    throw new Error("Failed to fetch properties");
  }
});
