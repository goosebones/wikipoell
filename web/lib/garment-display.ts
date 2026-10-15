// How a garment reads on screen. Titles aren't stored: a garment shows its
// `overrideTitle` if it has one, otherwise its model's name. The article code
// is rebuilt from each value's CCP code, in CCP's two-line format:
//   AF/0874-R          type, gender / model, procedures
//   ROOMS-PTC/14       material, processes / color
// Parts whose value has no code (a bare family like "black") are left out.
// Pure: takes the vocabulary as an argument, so client components can use it.
import { labelPath } from "@/lib/tree";
import type { Vocabulary } from "@/lib/vocabulary";
import type { Garment, Term, TreeNode } from "@/types";

// How a flat vocabulary value reads: "R – Rubber Drip", or just the code
// when it has no name.
export function termLabel(term: Term) {
  return term.label ? `${term.code} – ${term.label}` : term.code;
}

export function garmentTitle(garment: Garment, vocab: Vocabulary) {
  return (
    garment.overrideTitle ??
    vocab.models[garment.model ?? ""]?.label ??
    "Untitled"
  );
}

export function articleCode(garment: Garment, vocab: Vocabulary) {
  const code = (
    map: Record<string, { code?: string | null }>,
    id: string | null,
  ) => (id && map[id]?.code) || "";
  const dashed = (
    map: Record<string, { code?: string | null }>,
    ids: string[],
  ) => ids.map((id) => `-${code(map, id)}`).join("");

  const line1 =
    code(vocab.types, garment.type) +
    code(vocab.genders, garment.gender) +
    `/${garment.model ?? ""}` +
    dashed(vocab.procedures, garment.procedure);

  const materialCode = code(vocab.materials, garment.material);
  const material =
    materialCode && materialCode + dashed(vocab.processes, garment.process);
  const color = code(vocab.colors, garment.color);
  const line2 = material && color ? `${material}/${color}` : material || color;

  return [line1, line2] as const;
}

// Every field of a garment as it reads on screen, in article-code order then
// what the code leaves out: "R – Rubber Drip", "Black › 010 – Black
// (Leather)", "2600 – Lined Goodyear Derby". Empty values are "".
export function garmentFields(garment: Garment, vocab: Vocabulary) {
  const path = (tree: Record<string, TreeNode>, id: string | null) =>
    id ? labelPath(tree, id).join(" › ") : "";
  const terms = (map: Record<string, Term>, ids: (string | null)[]) =>
    ids.flatMap((id) => (id && map[id] ? [termLabel(map[id])] : [])).join(", ");
  return [
    { field: "title", label: "Title", value: garmentTitle(garment, vocab) },
    { field: "type", label: "Type", value: terms(vocab.types, [garment.type]) },
    {
      field: "gender",
      label: "Gender",
      value: terms(vocab.genders, [garment.gender]),
    },
    {
      field: "model",
      label: "Model",
      value: garment.model
        ? `${garment.model} – ${vocab.models[garment.model]?.label ?? ""}`
        : "",
    },
    {
      field: "procedure",
      label: "Procedure",
      value: terms(vocab.procedures, garment.procedure),
    },
    {
      field: "material",
      label: "Material",
      value: path(vocab.materials, garment.material),
    },
    {
      field: "process",
      label: "Process",
      value: terms(vocab.processes, garment.process),
    },
    {
      field: "color",
      label: "Color",
      value: path(vocab.colors, garment.color),
    },
    {
      field: "category",
      label: "Category",
      value: path(vocab.categories, garment.category),
    },
    {
      field: "extras",
      label: "Extras",
      value: garment.extras.map((e) => path(vocab.extras, e)).join(", "),
    },
  ];
}
