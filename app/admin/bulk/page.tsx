// Bulk edit at /admin/bulk: the garments with one data quality issue
// (?issue=no-color) or passing archive filters (?model=2600&color=black.010),
// rejected ones aside, all ticked to start, with one change to apply to the
// ticked ones. Admins only; everyone else gets the 404 page.
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { BulkEditor } from "@/components/bulk-editor";
import { Container } from "@/components/container";
import { requireAdmin } from "@/lib/auth";
import { FILTER_FIELDS, hasFilters, parseFilters } from "@/lib/filters";
import { editFields } from "@/lib/garment-edit";
import { BULK_LIMIT, getBulkGarments, ISSUES, isIssue } from "@/lib/quality";
import { nodeLabel } from "@/lib/tree";
import { getVocabulary, vocabularyTrees } from "@/lib/vocabulary";

export default function BulkPage({ searchParams }: PageProps<"/admin/bulk">) {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        {searchParams.then((params) => (
          <Bulk params={params} />
        ))}
      </Suspense>
    </Container>
  );
}

async function Bulk({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin();
  const vocab = await getVocabulary();
  const issue = isIssue(params.issue) ? params.issue : null;
  const filters = parseFilters(params);

  // What's selected, in words: the issue, or each filter's values.
  const trees = vocabularyTrees(vocab);
  const selection = issue
    ? ISSUES[issue].title
    : FILTER_FIELDS.flatMap((field) => {
        const ids = filters[field];
        if (!ids) return [];
        const names = ids.map((id) =>
          trees[field][id] ? nodeLabel(trees[field][id]) : id,
        );
        return [`${field}: ${names.join(" or ")}`];
      }).join(" · ");

  const { garments, more } =
    issue || hasFilters(filters)
      ? await getBulkGarments(issue ? { issue } : { filters })
      : { garments: [], more: false };

  return (
    <>
      <AdminNav current="quality" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Bulk edit</h1>
      {selection ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          {selection} · {garments.length}
          {more ? `+ (showing the newest ${BULK_LIMIT})` : ""} garments
        </p>
      ) : (
        <p className="mt-4 max-w-xl text-[13px] text-muted-foreground">
          Open bulk edit from an issue on the{" "}
          <Link
            href="/admin/quality"
            className="underline underline-offset-4"
          >
            data quality
          </Link>{" "}
          page, or with “Bulk edit these” on any garment grid.
        </p>
      )}
      {garments.length > 0 && (
        <BulkEditor
          // A fresh selection whenever the list changes.
          key={garments.map((g) => g.id).join()}
          garments={garments}
          fields={editFields(vocab)}
        />
      )}
      {selection && garments.length === 0 && (
        <p className="mt-6 text-[13px] text-muted-foreground">
          No garments to edit.
        </p>
      )}
    </>
  );
}
