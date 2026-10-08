// Home page. For now it shows live archive counts and the newest garments with
// their derived titles and article codes, as a check that the data layer
// works end to end. It becomes the search-led homepage in milestone 11.
import { cacheLife } from "next/cache";
import { Container } from "@/components/container";
import { garments, models } from "@/lib/db";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { getVocabulary } from "@/lib/vocabulary";

export default function Home() {
  return (
    <Container className="pt-16">
      <p className="eyebrow">Wikipoell</p>
      <ArchiveSummary />
    </Container>
  );
}

// Cached for an hour, so it is part of the page's static shell rather than a
// database query on every visit.
async function ArchiveSummary() {
  "use cache";
  cacheLife("hours");

  const vocab = await getVocabulary();
  const [garmentCount, modelCount, newest] = await Promise.all([
    garments.countDocuments({ status: "published" }),
    models.countDocuments(),
    garments
      .find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  return (
    <>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {garmentCount.toLocaleString("en")} garments · {modelCount} models
      </p>
      <ul className="mt-10 divide-y divide-muted border-y border-muted">
        {newest.map((garment) => {
          const [line1, line2] = articleCode(garment, vocab);
          return (
            <li
              key={garment._id.toString()}
              className="py-3"
            >
              <p className="text-sm font-medium">
                {garmentTitle(garment, vocab)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {line1} {line2}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
