import { initMongo } from "./mongodb";
import Garment from "@/models/Garment";

export { getGarmentCode, getOrderedGarmentPropertyList } from "./garment-utils";

const SIMILARITY_WEIGHTS = {
  model: 8,
  type: 6,
  categoryExact: 5,
  categoryTopLevel: 2,
  material: 4,
  process: 3,
  procedure: 3,
  gender: 1,
  color: 5,
};

export const getGarments = async (params = {}) => {
  const mongoQuery = {};

  // Handle other filters as $in queries on their respective fields
  Object.entries(params).forEach(([key, value]) => {
    if (key === "category") {
      const categoryValue = Array.isArray(params.category)
        ? params.category[0]
        : params.category;
      if (categoryValue) {
        mongoQuery.category = { $regex: `^${categoryValue}` };
      }
      return;
    }
    const valuesArray = Array.isArray(value) ? value : [value];
    // Ignore empty values
    const cleaned = valuesArray.filter(
      (v) => typeof v === "string" && v.length > 0,
    );
    if (cleaned.length === 0) return;
    // Merge with existing field constraints if any
    if (mongoQuery[key.toLowerCase()]) {
      const existing = mongoQuery[key.toLowerCase()].$in || [];
      mongoQuery[key.toLowerCase()] = {
        $in: Array.from(new Set([...existing, ...cleaned])),
      };
    } else {
      mongoQuery[key.toLowerCase()] = { $in: cleaned };
    }
  });

  try {
    await initMongo();
    const garments = await Garment.find({ ...mongoQuery, status: "published" });
    return JSON.parse(JSON.stringify(garments));
  } catch (error) {
    console.error("Error fetching garments:", error);
    throw new Error("Failed to fetch garments");
  }
};

export const getGarmentsByCategory = async (category) => {
  return await getGarments({ category: { $regex: `^${category}` } });
};

export const getGarmentById = async (id, { viewerUserId } = {}) => {
  try {
    await initMongo();
    const garment = await Garment.findById(id);
    if (!garment) return null;

    const isPublished = garment.status === "published";
    const isOwner =
      typeof viewerUserId === "string" &&
      viewerUserId.length > 0 &&
      garment.uploadedByUserId === viewerUserId;

    if (!isPublished && !isOwner) return null;

    return JSON.parse(JSON.stringify(garment));
  } catch (error) {
    console.error("Error fetching garment by id:", error);
    throw new Error("Failed to fetch garment by id");
  }
};

export const getGarmentsByUserId = async (uploadedByUserId) => {
  if (!uploadedByUserId) return [];
  try {
    await initMongo();
    const garments = await Garment.find({
      uploadedByUserId,
      status: "published",
    }).sort({
      createdAt: -1,
    });
    return JSON.parse(JSON.stringify(garments));
  } catch (error) {
    console.error("Error fetching garments by user:", error);
    throw new Error("Failed to fetch garments");
  }
};

export const getAdminQueue = async ({
  status = "pending",
  page = 1,
  limit = 10,
  title = "",
  id = "",
} = {}) => {
  try {
    await initMongo();
    const query = { status };
    if (id) {
      query._id = id;
    } else if (title) {
      query.title = { $regex: title, $options: "i" };
    }
    const skip = (page - 1) * limit;
    const [garments, total] = await Promise.all([
      Garment.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit),
      Garment.countDocuments(query),
    ]);
    return {
      garments: JSON.parse(JSON.stringify(garments)),
      total,
      page,
      limit,
    };
  } catch (error) {
    console.error("Error fetching admin queue:", error);
    throw new Error("Failed to fetch admin queue");
  }
};

function toStringArray(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.length > 0);
  }
  return typeof value === "string" && value.length > 0 ? [value] : [];
}

function categoryTopLevel(category) {
  if (typeof category !== "string" || category.length === 0) return null;
  return category.split(".")[0] || null;
}

function procedureOverlapScore(baseProcedure, candidateProcedure) {
  const base = new Set(toStringArray(baseProcedure));
  const candidate = new Set(toStringArray(candidateProcedure));
  if (base.size === 0 || candidate.size === 0) return 0;

  let overlap = 0;
  for (const value of base) {
    if (candidate.has(value)) overlap += 1;
  }

  if (overlap === 0) return 0;
  const unionSize = new Set([...base, ...candidate]).size || 1;
  return (overlap / unionSize) * SIMILARITY_WEIGHTS.procedure;
}

function computeSimilarityScore(baseGarment, candidate) {
  let score = 0;

  if (baseGarment.model && baseGarment.model === candidate.model) {
    score += SIMILARITY_WEIGHTS.model;
  }
  if (baseGarment.type && baseGarment.type === candidate.type) {
    score += SIMILARITY_WEIGHTS.type;
  }
  if (baseGarment.material && baseGarment.material === candidate.material) {
    score += SIMILARITY_WEIGHTS.material;
  }
  if (baseGarment.process && baseGarment.process === candidate.process) {
    score += SIMILARITY_WEIGHTS.process;
  }
  if (baseGarment.gender && baseGarment.gender === candidate.gender) {
    score += SIMILARITY_WEIGHTS.gender;
  }
  if (baseGarment.color && baseGarment.color === candidate.color) {
    score += SIMILARITY_WEIGHTS.color;
  }

  if (baseGarment.category && baseGarment.category === candidate.category) {
    score += SIMILARITY_WEIGHTS.categoryExact;
  } else {
    const baseTopLevel = categoryTopLevel(baseGarment.category);
    const candidateTopLevel = categoryTopLevel(candidate.category);
    if (baseTopLevel && baseTopLevel === candidateTopLevel) {
      score += SIMILARITY_WEIGHTS.categoryTopLevel;
    }
  }

  score += procedureOverlapScore(baseGarment.procedure, candidate.procedure);

  return score;
}

export const getSimilarGarments = async (
  baseGarment,
  { limit = 10, candidateLimit = 200 } = {},
) => {
  if (!baseGarment?._id) return [];

  const orConditions = [];
  const addEqualityCondition = (field) => {
    if (
      typeof baseGarment[field] === "string" &&
      baseGarment[field].length > 0
    ) {
      orConditions.push({ [field]: baseGarment[field] });
    }
  };

  ["model", "type", "material", "process", "gender", "color"].forEach(
    addEqualityCondition,
  );

  if (
    typeof baseGarment.category === "string" &&
    baseGarment.category.length > 0
  ) {
    orConditions.push({ category: baseGarment.category });
    const topLevel = categoryTopLevel(baseGarment.category);
    if (topLevel) {
      orConditions.push({ category: { $regex: `^${topLevel}\\.` } });
      orConditions.push({ category: topLevel });
    }
  }

  const procedureValues = toStringArray(baseGarment.procedure);
  if (procedureValues.length > 0) {
    orConditions.push({ procedure: { $in: procedureValues } });
  }

  if (orConditions.length === 0) return [];

  try {
    await initMongo();

    const candidates = await Garment.find({
      _id: { $ne: baseGarment._id },
      status: "published",
      $or: orConditions,
    })
      .sort({ createdAt: -1 })
      .limit(candidateLimit)
      .lean();

    const scored = candidates
      .map((candidate) => ({
        ...candidate,
        _similarityScore: computeSimilarityScore(baseGarment, candidate),
      }))
      .filter((candidate) => candidate._similarityScore > 0)
      .sort((a, b) => {
        if (b._similarityScore !== a._similarityScore) {
          return b._similarityScore - a._similarityScore;
        }
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      })
      .slice(0, limit)
      .map(({ _similarityScore, ...candidate }) => candidate);

    return JSON.parse(JSON.stringify(scored));
  } catch (error) {
    console.error("Error fetching similar garments:", error);
    throw new Error("Failed to fetch similar garments");
  }
};
