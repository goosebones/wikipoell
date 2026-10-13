// Reads CCP article codes, the inverse of articleCode() in garment-display.
// A port of the ingest pipeline's parser (wikipoell-ingest/ingest/normalize/
// article_code.py) and the vocabulary rules it applies afterwards (draft.py,
// vocabulary.py); the reasoning behind each pattern is written up there.
//
//   {TYPE}{GENDER}/{MODEL}[{PROC}][-{PROC}] {MATERIAL}[-{PROCESS}]/{COLOR}
//   LM/2699-IN BIMS-PTC/19      full form
//   MM/2144 SILVER              no color (jewelry)
//   AM/2603-IN 6                no material
//   MM/1914                     short form: metal accessories
//
// The model is always digits; letters right after it are a procedure
// (OM/2656OD-IN is model 2656 with OD and IN). Unlike the pipeline's parser,
// any number of dashed procedures are read (LM/2736-SV-IN), because that's
// how this site prints codes and visitors paste them back.
import { type FilterField, filterHref, type Filters } from "@/lib/filters";
import { nodeHref } from "@/lib/tree";
import type { Vocabulary } from "@/lib/vocabulary";

const HEAD = String.raw`^([A-Z])([MF])/{1,2}([0-9]+)([A-Z=]*)`;
// Dashed procedures after the model: -IN, -SV-IN, -IN/ST.
const DASHED = String.raw`((?:-[A-Z/=]+)*)`;
// A material may be several words, each of at least two letters.
const MATERIAL = String.raw`([A-Z=]{2,}(?:\s+[A-Z=]{2,})+|[A-Z=]+)(?:-([A-Z]+))?`;

const FULL = new RegExp(String.raw`${HEAD}${DASHED}\s+${MATERIAL}/(.+?)\s*$`);
const MEDIUM = new RegExp(String.raw`${HEAD}${DASHED}\s+${MATERIAL}\s*$`);
// The dashed run here is a procedure or a material depending on the
// vocabulary (-IN 6 vs -ASA/8), so it's left for decodeArticleCode to decide.
const NO_MATERIAL = new RegExp(
  String.raw`${HEAD}((?:-[A-Z=]+)*)[\s/]+([0-9]+[A-Z*]*)\s*$`,
);
const SHORT = new RegExp(String.raw`${HEAD}${DASHED}\s*$`);

// Undoes the ways retailers space and spell codes that CCP doesn't.
export function cleanArticleCode(raw: string) {
  return (
    raw
      .trim()
      .toUpperCase()
      // X≡NIT and XΞNIT are X=NIT.
      .replace(/[≡Ξ]/g, "=")
      // KMR/2785: a stray third letter in the type+gender slot.
      .replace(/^([A-Z])([MF])[A-Z](?=\/?[0-9])/, "$1$2")
      // AM2795: the slash after type+gender left out.
      .replace(/^([A-Z])([MF])(?=[0-9])/, "$1$2/")
      .replace(/\/\s+/g, "/")
      .replace(/\s+\//g, "/")
      // CORS 19: color separated from material by a space.
      .replace(/(\s[A-Z=]+(?:-[A-Z]+)?)\s+([0-9]+[A-Z*]*)$/, "$1/$2")
  );
}

export type ParsedCode = {
  type: string;
  gender: string;
  model: string;
  procedure: string[];
  material: string | null;
  process: string | null;
  color: string | null;
  // Dashed tokens that may be procedures or a material (NO_MATERIAL only).
  ambiguous: string[];
};

// The code's parts as written, or null if it matches none of the forms.
export function parseArticleCode(raw: string): ParsedCode | null {
  const text = cleanArticleCode(raw);
  const head = (m: RegExpMatchArray, dashed = "") => ({
    type: m[1],
    gender: m[2],
    model: m[3],
    procedure: [m[4], ...dashed.split("-")].filter(Boolean),
  });

  // FULL and MEDIUM share their groups; MEDIUM just has no color.
  const withMaterial = text.match(FULL) ?? text.match(MEDIUM);
  if (withMaterial) {
    return {
      ...head(withMaterial, withMaterial[5]),
      material: withMaterial[6],
      process: withMaterial[7] ?? null,
      color: withMaterial[8] ?? null,
      ambiguous: [],
    };
  }
  const noMaterial = text.match(NO_MATERIAL);
  if (noMaterial) {
    return {
      ...head(noMaterial),
      material: null,
      process: null,
      color: noMaterial[6],
      ambiguous: noMaterial[5].split("-").filter(Boolean),
    };
  }
  const short = text.match(SHORT);
  if (short) {
    return {
      ...head(short, short[5]),
      material: null,
      process: null,
      color: null,
      ambiguous: [],
    };
  }
  return null;
}

// One part of a decoded code: what it is, the code as written, and the
// vocabulary entry it names (`id` and `href` are null when the code isn't in
// the vocabulary; `name` is also null for codes with no description yet).
// `href` leads to the entry's page, or to the archive filtered to it.
export type DecodedPart = {
  title: string;
  field: FilterField;
  code: string;
  id: string | null;
  name: string | null;
  href: string | null;
};

// A pasted code explained against the vocabulary: its parts in code order,
// and filters for the garments it describes (null if a part isn't in the
// vocabulary, since no garment can match it). Procedures are left out of the
// filters, because a filter matches any of its values and a code's
// procedures all apply. Null when the code can't be read.
export function decodeArticleCode(raw: string, vocab: Vocabulary) {
  let parsed = parseArticleCode(raw);
  if (!parsed) return null;

  // Every vocabulary entry by its code.
  const byCode = <T extends { _id: string; code?: string | null }>(
    map: Record<string, T>,
  ) =>
    Object.fromEntries(
      Object.values(map)
        .filter((d) => d.code)
        .map((d) => [d.code!, d]),
    ) as Record<string, T>;
  const types = byCode(vocab.types);
  const genders = byCode(vocab.genders);
  const procedures = byCode(vocab.procedures);
  const materials = byCode(vocab.materials);
  const processes = byCode(vocab.processes);
  const colors = byCode(vocab.colors);

  // A dashed token that's a material means a form this parser doesn't read;
  // otherwise the tokens are procedures.
  if (parsed.ambiguous.some((token) => materials[token])) return null;
  parsed = { ...parsed, procedure: [...parsed.procedure, ...parsed.ambiguous] };

  // CON-EDGE and X-NIGHT are one material, not material + process.
  if (parsed.material && parsed.process) {
    for (const joiner of [" ", "-"]) {
      const joined = `${parsed.material}${joiner}${parsed.process}`;
      if (materials[joined]) {
        parsed = { ...parsed, material: joined, process: null };
        break;
      }
    }
  }

  // Retailers write 7 for 07, but 3 and 03 are different colors: pad only
  // when the bare code is unknown and the padded one isn't.
  const { color } = parsed;
  const colorCode =
    color && !colors[color] && /^\d$/.test(color) && colors[`0${color}`]
      ? `0${color}`
      : color;

  const part = (
    title: string,
    field: FilterField,
    code: string,
    entry: { _id: string; label: string | null } | undefined,
    href = (id: string) => filterHref("/garments", { [field]: [id] }),
  ): DecodedPart => ({
    title,
    field,
    code,
    id: entry?._id ?? null,
    name: entry?.label ?? null,
    href: entry ? href(entry._id) : null,
  });

  const parts = [
    part("Type", "type", parsed.type, types[parsed.type]),
    part("Gender", "gender", parsed.gender, genders[parsed.gender]),
    part(
      "Model",
      "model",
      parsed.model,
      vocab.models[parsed.model],
      (id) => `/model/${id}`,
    ),
    ...parsed.procedure.map((p) =>
      part("Procedure", "procedure", p, procedures[p]),
    ),
    ...(parsed.material
      ? [
          part(
            "Material",
            "material",
            parsed.material,
            materials[parsed.material],
            (id) => nodeHref("/material", id),
          ),
        ]
      : []),
    ...(parsed.process
      ? [part("Process", "process", parsed.process, processes[parsed.process])]
      : []),
    ...(colorCode
      ? [
          part("Color", "color", colorCode, colors[colorCode], (id) =>
            nodeHref("/color", id),
          ),
        ]
      : []),
  ];

  const described = parts.filter((p) => p.field !== "procedure");
  const filters: Filters | null = described.every((p) => p.id)
    ? Object.fromEntries(described.map((p) => [p.field, [p.id!]]))
    : null;
  return { parts, filters };
}
