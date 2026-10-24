// The search box: suggestions appear beneath it as you type (models,
// materials, colors, codes…), and arrow keys move through them. Enter opens
// the highlighted suggestion, or the full results at /search?q=… when none is
// highlighted; without JavaScript it's a plain form to that page. Escape or
// clicking elsewhere closes the suggestions.
// Props: defaultValue (the query already in the box), autoFocus, large (the
// homepage's bigger box).
"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { searchArchive } from "@/app/search/actions";
import { SearchResultRow } from "@/components/search-result";
import type { SearchResult } from "@/lib/search";
import { cn } from "@/lib/utils";

export function SearchBox({
  defaultValue = "",
  autoFocus,
  large,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  large?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const showList = open && results.length > 0;
  // Replies can arrive out of order; only the latest query's is shown.
  const latest = useRef(0);

  const change = async (value: string) => {
    setQuery(value);
    setOpen(true);
    const id = ++latest.current;
    const next = value.trim() ? await searchArchive(value) : [];
    if (id === latest.current) {
      setResults(next);
      setActive(-1);
    }
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // -1 is the box itself; the arrows cycle through it and the results.
      const step = e.key === "ArrowDown" ? 1 : -1;
      const stops = results.length + 1;
      setActive((i) => ((i + 1 + step + stops) % stops) - 1);
    }
    if (e.key === "Enter" && open && results[active]) {
      e.preventDefault();
      setOpen(false);
      router.push(results[active].href);
    }
    // Escape closes the suggestions; the browser's own Escape (clearing the
    // box) only happens once they're closed.
    if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Form
      action="/search"
      className="relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground",
          large ? "size-5" : "size-4",
        )}
      />
      <input
        name="q"
        type="search"
        value={query}
        onChange={(e) => change(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={keyDown}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search models, materials, colors, codes…"
        aria-label="Search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        className={cn(
          "w-full rounded-md bg-muted pr-3 text-foreground outline-none",
          large ? "h-12 pl-11 text-[16px]" : "h-10 pl-9 text-[14px]",
        )}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border bg-popover py-1 text-left text-popover-foreground shadow-lg"
        >
          {results.map((result, i) => (
            <li
              key={result.href}
              role="option"
              aria-selected={i === active}
            >
              <SearchResultRow
                result={result}
                active={i === active}
                onClick={() => setOpen(false)}
              />
            </li>
          ))}
        </ul>
      )}
    </Form>
  );
}
