// The vocabulary editor's index at /admin/vocabulary: every vocabulary with
// how many entries it has, each opening its editor. Admins only; everyone
// else gets the 404 page.
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { Container } from "@/components/container";
import { requireAdmin } from "@/lib/auth";
import { VOCABULARIES, type VocabName } from "@/lib/vocab-edit";
import { getVocabulary } from "@/lib/vocabulary";

export default function VocabularyIndexPage() {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        <Index />
      </Suspense>
    </Container>
  );
}

async function Index() {
  await requireAdmin();
  const vocab = await getVocabulary();
  return (
    <>
      <AdminNav current="vocabulary" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Vocabulary</h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(VOCABULARIES) as VocabName[]).map((name) => (
          <li key={name}>
            <Link
              href={`/admin/vocabulary/${name}`}
              className="flex items-baseline justify-between rounded-md border px-4 py-3 hover:bg-muted"
            >
              <span className="font-medium">{VOCABULARIES[name].title}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {Object.keys(vocab[name]).length}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
