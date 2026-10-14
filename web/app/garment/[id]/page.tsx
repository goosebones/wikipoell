// A garment's page at /garment/[id]: its photos (with a full-screen viewer),
// title, article code, a favorite button, and every attribute, in
// article-code order. Tree values (category, material, color,
// extras) are written out as full paths, each step but extras' linking to its
// page; the model links to its page. Ends with a link to the retailer listing
// the garment came from. Below it, similar garments (same piece, other
// colors, other materials, same category). Unknown or unpublished ids get the
// 404 page.
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { GarmentGallery } from "@/components/garment-gallery";
import { FavoriteButton } from "@/components/favorite-button";
import { SimilarGarments } from "@/components/similar-garments";
import { TreePath } from "@/components/tree-path";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { getGarment, getSimilarGarments } from "@/lib/garments";
import { ancestors, labelPath } from "@/lib/tree";
import { isFavorite } from "@/lib/favorites";
import { getVocabulary } from "@/lib/vocabulary";
import type { Term } from "@/types";

export default function GarmentPage({ params }: PageProps<"/garment/[id]">) {
  return (
    <Container className="pt-8">
      {/* The id comes from the URL, so it is only known per request. */}
      <Suspense>
        {params.then(({ id }) => (
          <>
            <GarmentDetails
              id={id}
              favorite={
                <Suspense fallback={<div className="h-8" />}>
                  <Favorite id={id} />
                </Suspense>
              }
            />
            <Suspense>
              <Similar id={id} />
            </Suspense>
          </>
        ))}
      </Suspense>
    </Container>
  );
}

// Cached for an hour per garment, under "garments" (every garment) and
// "garment:<id>" (just this one), so admin edits can refresh it. `favorite`
// (the visitor's own button) passes through the cache untouched.
async function GarmentDetails({
  id,
  favorite,
}: {
  id: string;
  favorite: React.ReactNode;
}) {
  "use cache";
  cacheLife("hours");
  cacheTag("garments", `garment:${id}`);

  const [vocab, garment] = await Promise.all([getVocabulary(), getGarment(id)]);
  if (!garment) notFound();

  const [line1, line2] = articleCode(garment, vocab);
  const title = garmentTitle(garment, vocab);
  const term = (t: Term | undefined) =>
    t && (t.label ? `${t.code} – ${t.label}` : t.code);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-12">
      <GarmentGallery
        images={garment.images.map((i) => i.url)}
        alt={title}
      />

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {garment.category &&
              ancestors(vocab.categories, garment.category)
                .map((c) => c.label)
                .join(" / ")}
          </p>
          <div className="shrink-0">{favorite}</div>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 font-mono text-[13px] leading-6 text-muted-foreground">
          {line1}
          <br />
          {line2}
        </p>

        <dl className="mt-8 divide-y divide-muted border-y border-muted text-[13px]">
          {/* Same order as the article code, then what the code leaves out. */}
          <Attribute label="Type">
            {term(vocab.types[garment.type ?? ""])}
          </Attribute>
          <Attribute label="Gender">
            {vocab.genders[garment.gender ?? ""]?.label}
          </Attribute>
          <Attribute label="Model">
            {garment.model && (
              <Link
                href={`/model/${garment.model}`}
                className="hover:underline"
              >
                {garment.model} – {vocab.models[garment.model]?.label}
              </Link>
            )}
          </Attribute>
          <Attribute label="Procedure">
            {garment.procedure.map((p) => term(vocab.procedures[p])).join(", ")}
          </Attribute>
          <Attribute label="Material">
            {garment.material && (
              <TreePath
                tree={vocab.materials}
                id={garment.material}
                base="/material"
              />
            )}
          </Attribute>
          <Attribute label="Process">
            {garment.process.map((p) => term(vocab.processes[p])).join(", ")}
          </Attribute>
          <Attribute label="Color">
            {garment.color && (
              <TreePath
                tree={vocab.colors}
                id={garment.color}
                base="/color"
              />
            )}
          </Attribute>
          <Attribute label="Category">
            {garment.category && (
              <TreePath
                tree={vocab.categories}
                id={garment.category}
                base="/category"
              />
            )}
          </Attribute>
          {/* Extras have no pages, so they're plain text. */}
          <Attribute label="Extras">
            {garment.extras.length > 0 &&
              garment.extras.map((e) => (
                <div key={e}>{labelPath(vocab.extras, e).join(" › ")}</div>
              ))}
          </Attribute>
        </dl>

        {garment.source?.url ? (
          <a
            href={garment.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block text-[13px] underline underline-offset-4"
          >
            View on {garment.source.label ?? "the original listing"} ↗
          </a>
        ) : (
          garment.source?.label && (
            <p className="mt-6 text-[13px] text-muted-foreground">
              Listed by {garment.source.label}
            </p>
          )
        )}
      </div>
    </div>
  );
}

// The visitor's favorite button, read per request. Clerk's auth() doesn't
// mark the render as per-request by itself, so connection() does, before the
// database is read.
async function Favorite({ id }: { id: string }) {
  await connection();
  const { userId } = await auth();
  const favorite =
    userId && ObjectId.isValid(id) ? await isFavorite(userId, id) : null;
  return (
    <FavoriteButton
      garmentId={id}
      favorite={favorite}
    />
  );
}

// Streams in after the garment itself.
async function Similar({ id }: { id: string }) {
  return <SimilarGarments sections={await getSimilarGarments(id)} />;
}

// One row of the attribute list; rows with nothing to show are left out.
function Attribute({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="flex gap-4 py-2.5">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
