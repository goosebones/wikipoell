// The admin edit screen at /garment/[id]/edit: the garment's cover photo,
// title, article code and status, then the editor for its title override and
// every vocabulary field. Works for garments of any status. With
// ?suggestion=<id> (from the review queue), that suggestion shows above the
// fields and saving accepts it. Admins only; everyone else, and unknown ids,
// get the 404 page.
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/container";
import { GarmentEditor } from "@/components/garment-editor";
import { requireAdmin } from "@/lib/auth";
import {
  EDIT_FIELDS,
  type EditField,
  getGarmentEdit,
  LIST_FIELDS,
} from "@/lib/garment-edit";
import { articleCode, garmentTitle } from "@/lib/garment-display";
import { getGarmentSuggestion } from "@/lib/review";
import { getVocabulary, vocabularyTrees } from "@/lib/vocabulary";

// The fields a missing value can be added to from the editor, and what kind
// of value that is.
const ADDABLE: Partial<Record<EditField, "model" | "materials" | "colors">> = {
  model: "model",
  material: "materials",
  color: "colors",
};

export default function EditGarmentPage({
  params,
  searchParams,
}: PageProps<"/garment/[id]/edit">) {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense>
        {Promise.all([params, searchParams]).then(
          ([{ id }, { suggestion }]) => (
            <Editor
              id={id}
              suggestionId={typeof suggestion === "string" ? suggestion : null}
            />
          ),
        )}
      </Suspense>
    </Container>
  );
}

async function Editor({
  id,
  suggestionId,
}: {
  id: string;
  suggestionId: string | null;
}) {
  await requireAdmin();
  const [vocab, found, suggestion] = await Promise.all([
    getVocabulary(),
    getGarmentEdit(id),
    suggestionId ? getGarmentSuggestion(suggestionId, id) : null,
  ]);
  if (!found) notFound();
  const { garment, edit } = found;
  const trees = vocabularyTrees(vocab);
  const [line1, line2] = articleCode(garment, vocab);
  const published = garment.status === "published";

  return (
    <>
      <p className="eyebrow">Edit garment</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden bg-muted">
          {garment.images[0] && (
            <Image
              src={garment.images[0].url}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {garmentTitle(garment, vocab)}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {line1} {line2}
            {" · "}
            {published ? (
              <Link
                href={`/garment/${id}`}
                className="hover:text-foreground hover:underline"
              >
                published
              </Link>
            ) : (
              garment.status
            )}
          </p>
        </div>
      </div>

      <GarmentEditor
        garmentId={id}
        published={published}
        edit={edit}
        fields={EDIT_FIELDS.map((field) => ({
          field,
          label: field[0].toUpperCase() + field.slice(1),
          tree: trees[field],
          multiple: LIST_FIELDS.has(field),
          addAs: ADDABLE[field] ?? null,
        }))}
        models={Object.fromEntries(
          Object.values(vocab.models).map((m) => [
            m._id,
            { label: m.label, category: m.suggestedCategory },
          ]),
        )}
        categories={vocab.categories}
        suggestion={suggestion}
      />
    </>
  );
}
