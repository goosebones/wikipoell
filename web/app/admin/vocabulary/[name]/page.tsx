// One vocabulary's editor at /admin/vocabulary/[name] (e.g. /materials): every
// entry in order (trees indented beneath their parents), each editable in
// place, with a form to add one. Unknown names get the 404 page. Admins only;
// everyone else gets the 404 page.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin-nav";
import { Container } from "@/components/container";
import { VocabEditor } from "@/components/vocab-editor";
import { requireAdmin } from "@/lib/auth";
import { FILTER_FIELDS, filterHref } from "@/lib/filters";
import { byCode } from "@/lib/tree";
import {
  getVocabEntries,
  isVocabName,
  VOCABULARIES,
  type VocabEntry,
} from "@/lib/vocab-edit";
import { getVocabulary } from "@/lib/vocabulary";
import type { TreeNode } from "@/types";

export default function VocabularyPage({
  params,
}: PageProps<"/admin/vocabulary/[name]">) {
  return (
    <Container className="pt-10">
      {/* Everything sits inside the boundary, so nothing renders for a
          non-admin before the check fails. */}
      <Suspense fallback={null}>
        {params.then(({ name }) => (
          <Editor name={name} />
        ))}
      </Suspense>
    </Container>
  );
}

async function Editor({ name }: { name: string }) {
  await requireAdmin();
  if (!isVocabName(name)) notFound();
  const { title, tree, codes, field } = VOCABULARIES[name];
  const [vocab, entries] = await Promise.all([
    getVocabulary(),
    getVocabEntries(name),
  ]);

  // The entries as tree nodes, for ordering and for choosing a parent.
  const nodes: Record<string, TreeNode> = Object.fromEntries(
    entries.map((e) => [
      e.id,
      { _id: e.id, label: e.label, parent: e.parent, code: e.code },
    ]),
  );
  // Where an entry's garments can be seen.
  const href = (id: string) =>
    name === "models"
      ? `/model/${id}`
      : (FILTER_FIELDS as readonly string[]).includes(field)
        ? filterHref("/garments", { [field]: [id] })
        : null;
  // In order, parents before children, each with its depth and link.
  const ordered: (VocabEntry & { depth: number; href: string | null })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const entry of entries
      .filter((e) => e.parent === parent)
      .sort((a, b) => byCode(nodes[a.id], nodes[b.id]))) {
      ordered.push({ ...entry, depth, href: href(entry.id) });
      walk(entry.id, depth + 1);
    }
  };
  walk(null, 0);
  return (
    <>
      <AdminNav current="vocabulary" />
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {entries.length} entries
      </p>
      <VocabEditor
        name={name}
        title={title}
        shape={name === "models" ? "models" : tree ? "tree" : "flat"}
        codes={codes}
        entries={ordered}
        nodes={nodes}
        categories={vocab.categories}
      />
    </>
  );
}
