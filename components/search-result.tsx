// One search result: what kind of thing it is (model, material…), its code,
// its name and how many garments it covers, linking to its page. Used in the
// search box's suggestions and on the /search page.
// Props: result (a SearchResult), active (highlighted by the keyboard),
// plus any other link props (e.g. onClick).
import Link from "next/link";
import type { SearchResult } from "@/lib/search";
import { cn } from "@/lib/utils";

export function SearchResultRow({
  result,
  active,
  className,
  ...props
}: {
  result: SearchResult;
  active?: boolean;
} & Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      href={result.href}
      className={cn(
        "grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-3 px-3 py-2 text-[13px] hover:bg-muted",
        active && "bg-muted",
        className,
      )}
      {...props}
    >
      <span className="eyebrow">{result.kind}</span>
      <span className="min-w-0">
        {result.code && (
          <span className="mr-2 font-mono text-xs">{result.code}</span>
        )}
        {result.label}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {result.count > 0 && result.count}
      </span>
    </Link>
  );
}
