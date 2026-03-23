import mongoose from "mongoose";

/** Legacy garments: string. New garments may use string (single) or string[] (multiple). */
function procedureValidator(value) {
  if (value == null || value === "") return true;
  if (typeof value === "string") return true;
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "string" && v.trim().length > 0);
  }
  return false;
}

const GarmentSchema = new mongoose.Schema(
  {
    imageGroupId: String,
    category: String,
    type: String,
    gender: String,
    procedure: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: procedureValidator,
        message:
          "procedure must be a non-empty string, an array of non-empty strings, or null/omitted",
      },
    },
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
