import mongoose from "mongoose";

const HomepageBackgroundSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.HomepageBackground ||
  mongoose.model("HomepageBackground", HomepageBackgroundSchema);

