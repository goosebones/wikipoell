import mongoose from "mongoose";

const GarmentSchema = new mongoose.Schema(
  {
    imageGroupId: {
      type: String,
      required: true,
    },
    category: String,
    type: String,
    gender: String,
    procedure: String,
    material: String,
    process: String,
    color: String,
    title: String,
    model: String,
    images: [
      {
        url: { type: String, required: true },
      },
    ],
    uploadedByUserId: {
      type: String,
      required: true,
    },
    source: {
      type: {
        type: String,
        enum: ["me", "external"],
      },
      label: String,
      url: String,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.Garment ||
  mongoose.model("Garment", GarmentSchema);
