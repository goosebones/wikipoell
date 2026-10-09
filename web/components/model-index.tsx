// The list of every model on /model: number, name, suggested category (from
// tablet width up) and garment count per row, each linking to the model's
// page. A filter box at the top narrows the list as you type, matching the
// number, name or category.
// Props: models (rows of { id, label, category, count }, already in order).
"use client";

import Link from "next/link";
import { useState } from "react";
import { FilterInput } from "@/components/filter-input";

type Row = { id: string; label: string; category: string; count: number };

export function ModelIndex({ models }: { models: Row[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = models.filter((m) =>
    `${m.id} ${m.label} ${m.category}`.toLowerCase().includes(q),
  );

  return (
    <>
      <div className="mt-6">
        <FilterInput
          value={query}
          onChange={setQuery}
          placeholder="Filter models by number, name or category…"
        />
      </div>
      {shown.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-muted border-y border-muted">
          {shown.map((m) => (
            <li key={m.id}>
              <Link
                href={`/model/${m.id}`}
                className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-4 py-2 text-[13px] hover:bg-muted/60 md:grid-cols-[4.5rem_1fr_14rem_3rem]"
              >
                <span className="font-mono text-xs">{m.id}</span>
                <span className="font-medium">{m.label}</span>
                <span className="hidden text-muted-foreground md:block">
                  {m.category}
                </span>
                <span className="text-right font-mono text-[11px] text-muted-foreground">
                  {m.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
