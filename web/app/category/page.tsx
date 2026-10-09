// The category index at /category: every category that has garments, grouped under
// its top-level category with garment counts, each linking to its page, with a
// filter box to narrow the list.
import { Container } from "@/components/container";
import { TreeIndex } from "@/components/tree-index";
import { getCounts } from "@/lib/garments";
import { rollUp } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

export default async function CategoryIndex() {
  const [vocab, counts] = await Promise.all([
    getVocabulary(),
    getCounts("category"),
  ]);
  return (
    <Container className="pt-10">
      <p className="eyebrow">Browse</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Categories</h1>
      <TreeIndex
        tree={vocab.categories}
        totals={rollUp(vocab.categories, counts)}
        base="/category"
        noun="categories"
      />
    </Container>
  );
}
