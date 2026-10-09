// The filter sidebar beside a garment grid: one list per field (type, gender,
// model, procedure, process), offering only values that occur in the grid's
// scope. Each value is a plain link that switches it on or off in the URL, so
// it works without JavaScript and keeps the scroll position.
// Props: options (value ids per field), filters (the active ones), vocab,
// href (builds the URL for a set of filters), hide (fields to leave out, e.g.
// model on a model page).
import Link from "next/link";
import { type FilterField, type Filters, toggleFilter } from "@/lib/filters";
import { cn } from "@/lib/utils";
import type { Vocabulary } from "@/lib/vocabulary";

// Panel order follows the article code: type, gender, model, procedure, then
// process.
// Each flat field's vocabulary map is named after it.
const SECTIONS = [
  { field: "type", title: "Type", terms: "types" },
  { field: "gender", title: "Gender", terms: "genders" },
  { field: "model", title: "Model", terms: null },
  { field: "procedure", title: "Procedure", terms: "procedures" },
  { field: "process", title: "Process", terms: "processes" },
] as const;

export function FilterPanel({
  options,
  filters,
  vocab,
  href,
  hide = [],
}: {
  options: Record<FilterField, string[]>;
  filters: Filters;
  vocab: Vocabulary;
  href: (filters: Filters) => string;
  hide?: FilterField[];
}) {
  // "2600 – Derby", "R – Rubber Drip", or just the code when there's no label.
  const label = (terms: (typeof SECTIONS)[number]["terms"], id: string) => {
    if (!terms) return `${id} – ${vocab.models[id]?.label ?? ""}`;
    const term = vocab[terms][id];
    if (!term) return id;
    return term.label ? `${term.code} – ${term.label}` : term.code;
  };

  return (
    <div className="space-y-8">
      {SECTIONS.filter(
        (s) => !hide.includes(s.field) && options[s.field].length > 0,
      ).map(({ field, title, terms }) => (
        <section key={field}>
          <h2 className="eyebrow">{title}</h2>
          <ul
            className={cn(
              "mt-2 space-y-0.5",
              field === "model" && "max-h-72 overflow-y-auto pr-2",
            )}
          >
            {options[field]
              .toSorted((a, b) => a.localeCompare(b, "en", { numeric: true }))
              .map((id) => {
                const active = filters[field]?.includes(id) ?? false;
                return (
                  <li key={id}>
                    <Link
                      href={href(toggleFilter(filters, field, id))}
                      scroll={false}
                      className={cn(
                        "flex items-start gap-2 py-0.5 text-[13px] text-muted-foreground hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-[3px] size-3 shrink-0 rounded-[3px] border border-current",
                          active && "bg-foreground",
                        )}
                      />
                      <span>{label(terms, id)}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
