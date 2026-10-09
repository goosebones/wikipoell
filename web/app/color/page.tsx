// The color index at /color: every color that has garments, grouped under
// its top-level color with garment counts, each linking to its page, with a
// filter box to narrow the list.
import { Container } from "@/components/container";
import { TreeIndex } from "@/components/tree-index";
import { getCounts } from "@/lib/garments";
import { rollUp } from "@/lib/tree";
import { getVocabulary } from "@/lib/vocabulary";

export default async function ColorIndex() {
  const [vocab, counts] = await Promise.all([
    getVocabulary(),
    getCounts("color"),
  ]);
  return (
    <Container className="pt-10">
      <p className="eyebrow">Browse</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Colors</h1>
      <TreeIndex
        tree={vocab.colors}
        totals={rollUp(vocab.colors, counts)}
        base="/color"
        noun="colors"
      />
    </Container>
  );
}
