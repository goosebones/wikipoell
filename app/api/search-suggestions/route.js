import { NextResponse } from "next/server";
import { initMongo } from "@/lib/mongodb";
import Garment from "@/models/Garment";
import { Property } from "@/lib/properties";

const SEARCHABLE_GARMENT_KEYS = [
  "procedure",
  "material",
  "process",
  "color",
  "title",
  "model",
];

const MAX_FILTER_SUGGESTIONS = 3;
const MAX_GARMENT_SUGGESTIONS = 12;

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuery(query) {
  if (typeof query !== "string") return "";
  return query.trim();
}

function mapGarmentSuggestion(garment) {
  const thumbnailUrl =
    Array.isArray(garment.images) && garment.images[0]?.url
      ? garment.images[0].url
      : null;

  return {
    type: "garment",
    id: garment._id.toString(),
    title: garment.title || "Untitled garment",
    href: `/garment/${garment._id.toString()}`,
    thumbnailUrl,
    garment: {
      model: garment.model || null,
      color: garment.color || null,
      material: garment.material || null,
      process: garment.process || null,
      procedure: garment.procedure || null,
    },
  };
}

function mapFilterSuggestion(property) {
  return {
    type: "filter",
    id: `${property.garmentKey}:${property.garmentValue}`,
    key: property.garmentKey,
    value: property.garmentValue,
    description: property.description || null,
    href: `/category?${new URLSearchParams({
      [property.garmentKey]: property.garmentValue,
    }).toString()}`,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = normalizeQuery(searchParams.get("q"));

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const regex = new RegExp(escapeRegExp(query), "i");
    await initMongo();

    const [properties, garments] = await Promise.all([
      Property.find({
        $or: [{ description: regex }, { garmentValue: regex }],
      })
        .sort({ garmentKey: 1, garmentValue: 1 })
        .limit(60)
        .lean(),
      Garment.find({
        status: "published",
        $or: SEARCHABLE_GARMENT_KEYS.map((key) => ({ [key]: regex })),
      })
        .sort({ createdAt: -1 })
        .limit(MAX_GARMENT_SUGGESTIONS)
        .lean(),
    ]);

    const seenFilterIds = new Set();
    const filterSuggestions = [];
    for (const property of properties) {
      const id = `${property.garmentKey}:${property.garmentValue}`;
      if (seenFilterIds.has(id)) continue;
      seenFilterIds.add(id);
      filterSuggestions.push(mapFilterSuggestion(property));
      if (filterSuggestions.length >= MAX_FILTER_SUGGESTIONS) break;
    }

    const suggestions = [
      ...filterSuggestions,
      ...garments.map((garment) => mapGarmentSuggestion(garment)),
    ];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch search suggestions" },
      { status: 500 },
    );
  }
}
