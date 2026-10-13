// Search results at /search?q=…: the search box, then every match (up to 50)
// as rows leading to each model, material, color, category or code. Reached
// by pressing Enter in a search box, or from the header's search link.
import { Suspense } from "react";
import { Container } from "@/components/container";
import { SearchBox } from "@/components/search-box";
import { SearchResultRow } from "@/components/search-result";
import { search } from "@/lib/search";

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Container className="pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      {/* The query comes from the URL, so it is only known per request. */}
      <Suspense>
        {searchParams.then(({ q }) => (
          <Results query={typeof q === "string" ? q : ""} />
        ))}
      </Suspense>
    </Container>
  );
}

async function Results({ query }: { query: string }) {
  const results = await search(query, 50);
  const n = results.length;
  const summary =
    n === 0
      ? `Nothing matches “${query}”.`
      : `${n}${n === 50 ? "+" : ""} ${n === 1 ? "result" : "results"}`;

  return (
    <>
      <div className="mt-6 max-w-xl">
        {/* Remounted per query, so the box shows the query just searched. */}
        <SearchBox
          key={query}
          defaultValue={query}
          autoFocus={!query}
        />
      </div>
      {query.trim() && (
        <p className="mt-8 font-mono text-xs text-muted-foreground">
          {summary}
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-3 max-w-3xl divide-y divide-muted border-y border-muted">
          {results.map((result) => (
            <li key={result.href}>
              <SearchResultRow result={result} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
