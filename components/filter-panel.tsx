// The filter panel for a garment grid: one folding section per field, each a
// list of choices (nested for categories, materials and colors) with how many
// garments each would show; choices that would show none are dimmed. Sections
// and nested choices start folded, unless something inside is ticked. Each
// choice is a plain link that switches it on or off in the URL, so it works
// without JavaScript and keeps the scroll position.
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
    <div className="divide-y divide-muted border-y border-muted">
      {sections.map(({ field, options }) => (
        <Fold
          key={field}
          open={!!props.filters[field]}
          summary={<h2 className="eyebrow flex-1 py-3">{field}</h2>}
        >
          {/* Long lists (models, procedures) scroll within the panel. */}
          <div
            className={cn(
              "pb-3",
              options.length > 20 && "max-h-72 overflow-y-auto pr-2",
            )}
          >
            <OptionList
              field={field}
              options={options}
              {...props}
            />
          </div>
        </Fold>
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
            <Fold
              open={props.filters[field]?.some((id) =>
                id.startsWith(`${option.id}.`),
              )}
              summary={
                <Choice
                  field={field}
                  option={option}
                  {...props}
                />
              }
            >
              <div className="ml-5">
                <OptionList
                  field={field}
                  options={option.children}
                  {...props}
                />
              </div>
            </Fold>
          )}
        </li>
      ))}
    </ul>
  );
}

// Something that folds open: the summary with a › beside it that turns when
// open, and the contents beneath.
function Fold({
  open,
  summary,
  children,
}: {
  open?: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="group"
    >
      <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="pl-2 text-[13px] text-muted-foreground group-open:rotate-90">
          ›
        </span>
      </summary>
      {children}
    </details>
  );
}

// One choice's on/off link: a small box (filled when on), its label and how
// many garments it would show.
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
        !active && option.count === 0 && "opacity-40",
      )}
    >
      <span
        className={cn(
          "mt-[3px] size-3 shrink-0 rounded-[3px] border border-current",
          active && "bg-foreground",
        )}
      />
      <span className="flex-1">{option.label}</span>
      <span className="mt-px font-mono text-[11px]">{option.count}</span>
    </Link>
  );
}
