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
    // Convert Mongoose documents to plain objects to avoid serialization issues
    return categories.map((category) => ({
      _id: category._id,
      parent: category.parent,
      name: category.name,
    }));
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw new Error("Failed to fetch categories");
  }
});
