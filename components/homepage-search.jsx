"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 2;

function GarmentSuggestionMeta({ garment }) {
  const metaPieces = [
    garment.model,
    garment.material,
    garment.process,
    garment.color,
  ].filter(Boolean);

  if (metaPieces.length === 0) return null;
  return (
    <p className="text-xs text-black/60 truncate">{metaPieces.join(" · ")}</p>
  );
}

export default function HomepageSearch() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const abortRef = useRef(null);

  const canSearch = query.trim().length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!canSearch) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/search-suggestions?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Request failed");
        const payload = await response.json();
        setSuggestions(
          Array.isArray(payload.suggestions) ? payload.suggestions : [],
        );
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error fetching search suggestions:", error);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, canSearch]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const emptyMessage = useMemo(() => {
    if (!canSearch) return `Type at least ${MIN_QUERY_LENGTH} characters`;
    if (isLoading) return "Searching...";
    if (suggestions.length === 0) return "No suggestions found";
    return null;
  }, [canSearch, isLoading, suggestions.length]);

  return (
    <div className="w-full max-w-2xl">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/50" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
          placeholder="Search garments or browse filters..."
          className="h-11 w-full rounded-md border border-black/20 bg-white/95 pl-9 pr-10 text-sm text-black shadow-sm backdrop-blur-sm outline-none transition focus:border-black/50"
          aria-label="Search garments and filters"
        />
        {isLoading && (
          <Loader2Icon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-black/60" />
        )}
      </div>

      {isOpen && (
        <div className="mt-2 overflow-hidden rounded-md border border-black/15 bg-white/95 shadow-md backdrop-blur-sm">
          {emptyMessage ? (
            <p className="px-3 py-2 text-sm text-black/60">{emptyMessage}</p>
          ) : (
            <ul className="max-h-[min(24rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain py-1">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.type}-${suggestion.id}`}>
                  <Link
                    href={suggestion.href}
                    className={
                      suggestion.type === "garment"
                        ? "block px-3 py-3 transition hover:bg-black/5"
                        : "block px-3 py-2 transition hover:bg-black/5"
                    }
                  >
                    {suggestion.type === "filter" ? (
                      <div>
                        <p className="text-sm font-medium text-black">
                          Browse: {suggestion.key}={suggestion.value}
                        </p>
                        {suggestion.description && (
                          <p className="text-xs text-black/60 truncate">
                            {suggestion.description}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-black/10 bg-black/5">
                          {suggestion.thumbnailUrl ? (
                            <img
                              src={suggestion.thumbnailUrl}
                              alt={suggestion.title || "Garment thumbnail"}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 py-0.5">
                          <p className="text-sm font-medium text-black truncate">
                            {suggestion.title}
                          </p>
                          <GarmentSuggestionMeta
                            garment={suggestion.garment || {}}
                          />
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
