// The shape of every document the app reads and writes, matching SCHEMA.md and
// the validators in scripts/setup-db.mjs. Vocabulary ids are slugs (tree ids
// are dot paths like "black.010"); `code` is the CCP code as CCP writes it.
import type { ObjectId } from "mongodb";

// Flat vocabulary: types, genders, procedures, processes.
export type Term = {
  _id: string;
  code: string;
  label: string | null;
};

// Tree vocabulary: colors, materials (with codes) and extras (without).
export type TreeNode = {
  _id: string;
  label: string;
  parent: string | null;
  code?: string | null;
};

// Categories predate slugs: camelCase path ids and `name` instead of `label`.
export type Category = {
  _id: string;
  name: string;
  parent: string | null;
};

export type Model = {
  _id: string; // the model number, e.g. "2600"
  label: string;
  suggestedCategory: string;
};

export type GarmentStatus = "pending" | "published" | "rejected";

export type Garment = {
  _id: ObjectId;
  gender: string | null;
  model: string | null;
  material: string | null;
  color: string | null;
  type: string | null;
  category: string | null;
  procedure: string[];
  process: string[];
  extras: string[];
  overrideTitle: string | null;
  imageGroupId: string;
  images: { url: string; sourceUrl?: string }[];
  status: GarmentStatus;
  uploadedByUserId: string;
  source?: { type: "me" | "external"; label?: string; url?: string };
  // Present on pipeline garments only; its details are typed when the admin
  // ingest views need them.
  ingest?: { source: string; siteKey: string; humanReviewedAt?: Date };
  createdAt: Date;
  updatedAt: Date;
};

export type User = {
  _id: ObjectId;
  userId: string; // Clerk user id
  username: string | null;
  email: string | null;
  imageUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HomepageBackground = {
  _id: ObjectId;
  imageUrl: string;
  active: boolean;
};
