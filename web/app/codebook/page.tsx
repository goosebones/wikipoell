// The codebook at /codebook: how a CCP article code is put together, a box to
// decode one, and every type, gender, procedure and process code with what it
// means and how many garments carry it, each linking to those garments.
// Models, materials and colors have their own index pages, linked from here.
import Link from "next/link";
import { Fragment } from "react";
import { Container } from "@/components/container";
import { DecodeForm } from "@/components/decode-form";
import { filterHref } from "@/lib/filters";
import { getCounts } from "@/lib/garments";
import { getVocabulary } from "@/lib/vocabulary";

// The example code split into its parts, in order, with what each one is.
const EXAMPLE = [
  { code: "A", part: "Type" },
  { code: "M", part: "Gender" },
  { code: "/2600", part: "Model" },
  { code: "-LR", part: "Procedure" },
  { code: " ROOMS", part: "Material" },
  { code: "-PTC", part: "Process" },
  { code: "/010", part: "Color" },
];

export default async function CodebookPage() {
  const fields = [
    { field: "type", title: "Types", terms: "types" },
    { field: "gender", title: "Genders", terms: "genders" },
    { field: "procedure", title: "Procedures", terms: "procedures" },
    { field: "process", title: "Processes", terms: "processes" },
  ] as const;
  const [vocab, ...counts] = await Promise.all([
    getVocabulary(),
    ...fields.map(({ field }) => getCounts(field)),
  ]);
  const sections = fields.map(({ field, title, terms }, i) => ({
    field,
    title,
    rows: Object.values(vocab[terms])
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((term) => ({
        code: term.code,
        label: term.label,
        count: counts[i][term._id] ?? 0,
        href: filterHref("/garments", { [field]: [term._id] }),
      })),
  }));

  return (
    <Container className="pt-10">
      <p className="eyebrow">Reference</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Codebook</h1>
      <p className="mt-4 max-w-xl text-[15px] text-muted-foreground">
        Every CCP piece carries an article code that spells out what it is. Each
        part of the code is one attribute:
      </p>

      <p className="mt-6 font-mono text-xl whitespace-nowrap sm:text-2xl">
        {EXAMPLE.map(({ code }) => code).join("")}
      </p>
      <dl className="mt-4 grid max-w-md grid-cols-[5rem_1fr] gap-x-4 gap-y-1 text-[13px]">
        {EXAMPLE.map(({ code, part }) => (
          <Fragment key={part}>
            <dt className="font-mono text-xs">{code.trim()}</dt>
            <dd className="text-muted-foreground">{part}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="mt-6 max-w-xl text-[13px] text-muted-foreground">
        Procedures and the process are optional, and a piece may have several
        procedures. Models, materials and colors have their own pages:{" "}
        <Link
          href="/model"
          className="underline underline-offset-4"
        >
          models
        </Link>
        ,{" "}
        <Link
          href="/material"
          className="underline underline-offset-4"
        >
          materials
        </Link>
        ,{" "}
        <Link
          href="/color"
          className="underline underline-offset-4"
        >
          colors
        </Link>
        .
      </p>

      <h2 className="eyebrow mt-10">Decode a code</h2>
      <div className="mt-3">
        <DecodeForm />
      </div>

      <div className="mt-12 grid gap-12 md:grid-cols-2">
        {sections.map((section) => (
          <CodeTable
            key={section.field}
            title={section.title}
            rows={section.rows}
          />
        ))}
      </div>
    </Container>
  );
}

// One vocabulary's codes: code, meaning and garment count per row, each
// linking to those garments.
function CodeTable({
  title,
  rows,
}: {
  title: string;
  rows: { code: string; label: string | null; count: number; href: string }[];
}) {
  return (
    <section>
      <h2 className="font-medium">{title}</h2>
      <ul className="mt-3 divide-y divide-muted border-y border-muted">
        {rows.map((row) => (
          <li key={row.code}>
            <Link
              href={row.href}
              className="grid grid-cols-[4rem_1fr_auto] items-baseline gap-3 py-2 text-[13px] hover:bg-muted/60"
            >
              <span className="font-mono text-xs">{row.code}</span>
              <span className={row.label ? "" : "text-muted-foreground"}>
                {row.label ?? "No description yet"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {row.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
