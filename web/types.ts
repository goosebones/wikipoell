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
  // Present on pipeline garments only. `runId` is the run that created it;
  // `review` is what the pipeline read from the listing (each field with how
  // sure it was and where it came from) and why it held the garment back for
  // a person, if it did.
  ingest?: {
    source: string;
    siteKey: string;
    runId?: string;
    humanReviewedAt?: Date;
    review?: {
      reasons?: string[];
      fields?: Record<
        string,
        { value: string | string[]; confidence: number; origin: string }
      >;
      llm?: { notes?: string };
    };
  };
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

// A garment a user has marked as a favorite (SCHEMA.md, "User data").
export type UserFavorite = {
  userId: string; // Clerk user id
  garmentId: ObjectId;
  createdAt: Date;
};

// A correction suggested by a user (SCHEMA.md, "User data"). The driver adds
// `_id` when one is read back.
export type Suggestion = {
  userId: string;
  target: {
    collection: "garments" | "models" | "categories" | "materials" | "colors";
    id: string;
  };
  field: string;
  current: string;
  proposed: string;
  note: string;
  status: "open" | "accepted" | "dismissed";
  createdAt: Date;
};

// One run of the ingest pipeline (`ingestruns`); its id is stamped on every
// garment it created.
export type IngestRun = {
  _id: string;
  startedAt: Date;
  finishedAt?: Date;
  durationMs?: number;
  status: string;
  trigger?: string;
  sources?: {
    name: string;
    status: string;
    listingsFound?: number;
    created?: number;
    updated?: number;
    published?: number;
    needsReview?: number;
    failed?: number;
  }[];
  failures?: unknown[];
};

export type HomepageBackground = {
  _id: ObjectId;
  imageUrl: string;
  active: boolean;
};
