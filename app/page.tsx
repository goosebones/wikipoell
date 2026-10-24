// The homepage: a full-screen rotating background with the search box front
// and center, the archive's size beneath it, and a few example searches to
// show what can be searched for.
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Container } from "@/components/container";
import { HomeBackground } from "@/components/home-background";
import { SearchBox } from "@/components/search-box";
import { garments, homepageBackgrounds, models } from "@/lib/db";

// Searches that show the range: a model number, a material, a procedure and
// a full article code.
const EXAMPLES = ["2600", "ROOMS", "Rubber Drip", "AM/2600-LR ROOMS/010"];

export default async function Home() {
  const { backgrounds, garmentCount, modelCount } = await getHomeData();

  return (
    // The header is 3.5rem tall; the hero fills the rest of the screen.
    <div className="relative isolate flex min-h-[calc(100svh-3.5rem)] items-center">
      <HomeBackground images={backgrounds} />
      <Container className="w-full py-16 text-white">
        <p className="eyebrow text-white/70">wikipoell</p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find any piece by model, material, color or code.
        </h1>
        <div className="mt-8 max-w-xl">
          <SearchBox large />
        </div>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/70">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <Link
              key={example}
              href={`/search?q=${encodeURIComponent(example)}`}
              className="font-mono text-white underline-offset-4 hover:underline"
            >
              {example}
            </Link>
          ))}
        </p>
        <p className="mt-10 font-mono text-xs text-white/70">
          {garmentCount.toLocaleString("en")} garments · {modelCount} models ·{" "}
          <Link
            href="/garments"
            className="text-white underline-offset-4 hover:underline"
          >
            Browse all →
          </Link>
        </p>
      </Container>
    </div>
  );
}

// Cached for an hour, so the homepage is part of the static shell rather than
// database queries on every visit.
async function getHomeData() {
  "use cache";
  cacheLife("hours");
  cacheTag("garments", "backgrounds");

  const [backgrounds, garmentCount, modelCount] = await Promise.all([
    homepageBackgrounds.find({ active: true }).toArray(),
    garments.countDocuments({ status: "published" }),
    models.countDocuments(),
  ]);
  return {
    backgrounds: backgrounds.map((b) => b.imageUrl),
    garmentCount,
    modelCount,
  };
}
