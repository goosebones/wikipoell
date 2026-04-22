import { initMongo } from "./mongodb";
import HomepageBackground from "@/models/HomepageBackground";

export async function getRandomHomepageBackground() {
  try {
    await initMongo();

    const [background] = await HomepageBackground.aggregate([
      { $match: { active: true } },
      { $sample: { size: 1 } },
      { $project: { imageUrl: 1 } },
    ]);

    return background?.imageUrl ?? null;
  } catch (error) {
    console.error("Error fetching random homepage background:", error);
    return null;
  }
}

