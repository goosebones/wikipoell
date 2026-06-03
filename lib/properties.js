import mongoose, { Schema, model, models } from "mongoose";
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

/** Match _id whether stored as string (UUID) or legacy ObjectId hex. */
export function propertyByIdFilter(id) {
  const s = String(id);
  if (/^[a-f\d]{24}$/i.test(s)) {
    return { _id: { $in: [s, new mongoose.Types.ObjectId(s)] } };
  }
  return { _id: s };
}

function serializeProperty(doc) {
  if (!doc) return null;
  return JSON.parse(
    JSON.stringify({ ...doc, _id: String(doc._id) }),
  );
}

/** Writes bypass Mongoose _id:String casting so legacy ObjectId rows match. */
export async function updatePropertyById(id, update) {
  await initMongo();
  const result = await Property.collection.findOneAndUpdate(
    propertyByIdFilter(id),
    { $set: update },
    { returnDocument: "after" },
  );
  return serializeProperty(result);
}

export async function deletePropertyById(id) {
  await initMongo();
  const result = await Property.collection.findOneAndDelete(
    propertyByIdFilter(id),
  );
  return serializeProperty(result);
}

export const getProperties = cache(async () => {
  try {
    await initMongo();
    const properties = await Property.find({}).sort({ description: 1 });
    const serialized = JSON.parse(JSON.stringify(properties));
    return serialized.map((p) => ({ ...p, _id: String(p._id) }));
  } catch (error) {
    console.error("Error fetching properties:", error);
    throw new Error("Failed to fetch properties");
  }
});
