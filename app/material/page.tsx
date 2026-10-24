// The material index at /material: every material that has garments, grouped
// under its top-level material with garment counts, each linking to its page,
// with a filter box to narrow the list.
import type { Metadata } from "next";
import { Container } from "@/components/container";
import { TreeIndex } from "@/components/tree-index";
import { getCounts } from "@/lib/garments";
import { rollUp } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

export const metadata: Metadata = {
  title: "Materials",
  description: "Every Carol Christian Poell material code and what it means.",
};

export default async function MaterialIndex() {
  const [vocab, counts] = await Promise.all([
    getVocabulary(),
    getCounts("material"),
  ]);
  return (
    <Container className="pt-10">
      <p className="eyebrow">Browse</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Materials</h1>
      <TreeIndex
        tree={vocab.materials}
        totals={rollUp(vocab.materials, counts)}
        base="/material"
        noun="materials"
      />
    </Container>
  );
}
