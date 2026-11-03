// The filter panel for a garment grid: one folding section per field, each a
// list of choices (nested for categories, materials and colors) with how many
// garments each would show; choices that would show none are dimmed. A
// section's choices arrive with the page only when one is ticked (it starts
// open); the rest load the first time the section is opened, which keeps
// pages small and gives crawlers nothing to follow. Each choice is a plain
// nofollow link that switches it on or off in the URL and keeps the scroll
// position. A client component, for the loading.
// Props: sections (each field, with its choices or null until opened), load
// (fetches a field's choices).
"use client";

import Link from "next/link";
import { useState } from "react";
import type { FilterChoice, FilterField } from "@/lib/filters";
import { cn } from "@/lib/utils";

type Section = { field: FilterField; choices: FilterChoice[] | null };

export function FilterPanel({
  sections,
  load,
}: {
  sections: Section[];
  load: (field: FilterField) => Promise<FilterChoice[]>;
}) {
  return (
    <div className="divide-y divide-muted border-y border-muted">
      {sections.map((section) => (
        <PanelSection
          key={section.field}
          {...section}
          load={load}
        />
      ))}
    </div>
  );
}

function PanelSection({
  field,
  choices,
  load,
}: Section & { load: (field: FilterField) => Promise<FilterChoice[]> }) {
  const [loaded, setLoaded] = useState(choices);
  return (
    <Fold
      open={choices !== null}
      onOpen={() => {
        if (!loaded) load(field).then(setLoaded);
      }}
      summary={<h2 className="eyebrow flex-1 py-3">{field}</h2>}
    >
      {/* Long lists (models, procedures) scroll within the panel. */}
      <div
        className={cn(
          "pb-3",
          loaded && loaded.length > 20 && "max-h-72 overflow-y-auto pr-2",
        )}
      >
        {!loaded ? (
          <p className="py-0.5 text-[13px] text-muted-foreground">Loading…</p>
        ) : loaded.length === 0 ? (
          <p className="py-0.5 text-[13px] text-muted-foreground">
            Nothing to choose here.
          </p>
        ) : (
          <ChoiceList choices={loaded} />
        )}
      </div>
    </Fold>
  );
}

function ChoiceList({ choices }: { choices: FilterChoice[] }) {
  return (
    <ul className="space-y-0.5">
      {choices.map((choice) => (
        <li key={choice.id}>
          {choice.children.length === 0 ? (
            <Choice choice={choice} />
          ) : (
            <Fold
              open={choice.open}
              summary={<Choice choice={choice} />}
            >
              <div className="ml-5">
                <ChoiceList choices={choice.children} />
              </div>
            </Fold>
          )}
        </li>
      ))}
    </ul>
  );
}

// Something that folds open: the summary with a › beside it that turns when
// open, and the contents beneath. `onOpen` runs each time it opens.
function Fold({
  open,
  onOpen,
  summary,
  children,
}: {
  open?: boolean;
  onOpen?: () => void;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => e.currentTarget.open && onOpen?.()}
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

// One choice: a tick box, its label and count. Not prefetched, since a panel
// shows dozens at once.
function Choice({ choice }: { choice: FilterChoice }) {
  return (
    <Link
      href={choice.href}
      rel="nofollow"
      prefetch={false}
      scroll={false}
      className={cn(
        "flex flex-1 items-start gap-2 py-0.5 text-[13px] text-muted-foreground hover:text-foreground",
        choice.active && "text-foreground",
        !choice.active && choice.count === 0 && "opacity-40",
      )}
    >
      <span
        className={cn(
          "mt-[3px] size-3 shrink-0 rounded-[3px] border border-current",
          choice.active && "bg-foreground",
        )}
      />
      <span className="flex-1">{choice.label}</span>
      <span className="mt-px font-mono text-[11px]">{choice.count}</span>
    </Link>
  );
}
