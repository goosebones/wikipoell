import { Schema, model, models } from "mongoose";
import { cache } from "react";
import { initMongo } from "./mongodb";

const categorySchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  parent: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
});
export const Category = models.Category || model("Category", categorySchema);

export const getCategories = cache(async () => {
  try {
    await initMongo();
    const categories = await Category.find({});
    return JSON.parse(JSON.stringify(categories));
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw new Error("Failed to fetch categories");
  }
});
