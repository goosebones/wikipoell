// The model index at /model: every model with its number, name, suggested
// category and garment count, in model-number order, with a filter box to
// narrow the list. The list itself is ModelIndex.
import { Container } from "@/components/container";
import { ModelIndex } from "@/components/model-index";
import { getCounts } from "@/lib/garments";
import { getVocabulary } from "@/lib/vocabulary";

export default async function ModelIndexPage() {
  const [vocab, counts] = await Promise.all([
    getVocabulary(),
    getCounts("model"),
  ]);
  const models = Object.values(vocab.models)
    .sort((a, b) => a._id.localeCompare(b._id, "en", { numeric: true }))
    .map((m) => ({
      id: m._id,
      label: m.label,
      category: vocab.categories[m.suggestedCategory]?.label ?? "",
      count: counts[m._id] ?? 0,
    }));

  return (
    <Container className="pt-10">
      <p className="eyebrow">Browse</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Models</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {models.length} models
      </p>
      <ModelIndex models={models} />
    </Container>
  );
}
