// The filter sidebar beside a garment grid: one section per field, each a
// list of choices (nested for categories, materials and colors). A choice with
// choices beneath it folds open, and starts open when one of them is ticked.
// Each choice is a plain link that switches it on or off in the URL, so it
// works without JavaScript and keeps the scroll position.
// Props: sections (from getFilterSections), filters (the active ones), href
// (builds the URL for a set of filters).
import Link from "next/link";
import {
  type FilterField,
  type FilterOption,
  type Filters,
  toggleFilter,
} from "@/lib/filters";
import { cn } from "@/lib/utils";

type Props = {
  filters: Filters;
  href: (filters: Filters) => string;
};

export function FilterPanel({
  sections,
  ...props
}: Props & { sections: { field: FilterField; options: FilterOption[] }[] }) {
  return (
    <div className="space-y-8">
      {sections.map(({ field, options }) => (
        <section key={field}>
          <h2 className="eyebrow">{field}</h2>
          {/* Long lists (models, procedures) scroll within the panel. */}
          <div
            className={cn(
              "mt-2",
              options.length > 20 && "max-h-72 overflow-y-auto pr-2",
            )}
          >
            <OptionList
              field={field}
              options={options}
              {...props}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function OptionList({
  field,
  options,
  ...props
}: Props & { field: FilterField; options: FilterOption[] }) {
  return (
    <ul className="space-y-0.5">
      {options.map((option) => (
        <li key={option.id}>
          {option.children.length === 0 ? (
            <Choice
              field={field}
              option={option}
              {...props}
            />
          ) : (
            <details
              open={props.filters[field]?.some((id) =>
                id.startsWith(`${option.id}.`),
              )}
              className="group"
            >
              <summary className="flex cursor-pointer list-none items-start [&::-webkit-details-marker]:hidden">
                <Choice
                  field={field}
                  option={option}
                  {...props}
                />
                <span className="px-1 text-[13px] text-muted-foreground group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="ml-5">
                <OptionList
                  field={field}
                  options={option.children}
                  {...props}
                />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

// One choice's on/off link: a small box (filled when on) and its label.
function Choice({
  field,
  option,
  filters,
  href,
}: Props & { field: FilterField; option: FilterOption }) {
  const active = filters[field]?.includes(option.id);
  return (
    <Link
      href={href(toggleFilter(filters, field, option.id))}
      scroll={false}
      className={cn(
        "flex flex-1 items-start gap-2 py-0.5 text-[13px] text-muted-foreground hover:text-foreground",
        active && "text-foreground",
      )}
    >
      <span
        className={cn(
          "mt-[3px] size-3 shrink-0 rounded-[3px] border border-current",
          active && "bg-foreground",
        )}
      />
      {option.label}
    </Link>
  );
}
