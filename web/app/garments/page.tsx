// The archive grid at /garments: every published garment as a card, newest
// first. Shows the first 48 for now; pagination, sorting and the list view
// come in the next chunks.
import { cacheLife, cacheTag } from "next/cache";
import { Container } from "@/components/container";
import { GarmentCard } from "@/components/garment-card";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { getPublishedGarments } from "@/lib/garments";
import { getVocabulary } from "@/lib/vocabulary";

export default function GarmentsPage() {
  return (
    <Container className="pt-10">
      <p className="eyebrow">Archive</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        All garments
      </h1>
      <GarmentGrid />
    </Container>
  );
}

// Cached for an hour under the "garments" tag, so the grid is part of the
// static page; admin edits will refresh it through the tag.
async function GarmentGrid() {
  "use cache";
  cacheLife("hours");
  cacheTag("garments");

  const [vocab, garments] = await Promise.all([
    getVocabulary(),
    getPublishedGarments(48),
  ]);

  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
      {garments.map((garment) => (
        <GarmentCard
          key={garment._id.toString()}
          id={garment._id.toString()}
          title={garmentTitle(garment, vocab)}
          code={articleCode(garment, vocab)}
          image={garment.images[0]?.url}
        />
      ))}
    </div>
  );
}
