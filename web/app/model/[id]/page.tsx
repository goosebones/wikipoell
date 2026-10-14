// A model's page at /model/[id] (e.g. /model/2600): the model's name and
// number, its suggested category, a "Suggest a correction" link, a matrix of
// which material × color combinations exist, and every published garment of
// the model, with the usual sort, view and endless scrolling. Unknown models
// get the 404 page.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/container";
import { GarmentBrowser } from "@/components/garment-browser";
import { SuggestCorrection } from "@/components/suggest-correction";
import { VariantMatrix } from "@/components/variant-matrix";
import { countGarments, getVariantMatrix } from "@/lib/garments";
import { getSuggestionFields } from "@/lib/suggestions";
import { ancestors, nodeHref } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

export default function ModelPage({
  params,
  searchParams,
}: PageProps<"/model/[id]">) {
  return (
    <Container className="pt-10">
      {/* The model comes from the URL, so it is only known per request. */}
      <Suspense>
        <Model
          params={params}
          searchParams={searchParams}
        />
      </Suspense>
    </Container>
  );
}

async function Model({ params, searchParams }: PageProps<"/model/[id]">) {
  const { id } = await params;
  const vocab = await getVocabulary();
  const model = vocab.models[id];
  if (!model) notFound();

  const scope = { model: [id] };
  const target = { collection: "models", id } as const;
  const [count, matrix, suggestionFields] = await Promise.all([
    countGarments(scope),
    getVariantMatrix(id),
    getSuggestionFields(target),
  ]);
  const category = ancestors(vocab.categories, model.suggestedCategory);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Models", href: "/model" },
          { label: id, href: `/model/${id}` },
        ]}
      />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {model.label}
      </h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        Model {id} · {count.toLocaleString("en")} garments
        {category.length > 0 && (
          <>
            {" · "}
            <Link
              href={nodeHref("/category", model.suggestedCategory)}
              className="hover:text-foreground hover:underline"
            >
              {category.map((c) => c.label).join(" / ")}
            </Link>
          </>
        )}
      </p>
      {suggestionFields && (
        <div className="mt-2">
          <SuggestCorrection
            target={target}
            fields={suggestionFields}
          />
        </div>
      )}

      {count > 0 && <VariantMatrix matrix={matrix} />}

      <GarmentBrowser
        searchParams={searchParams}
        scope={scope}
        basePath={`/model/${id}`}
      />
    </>
  );
}
