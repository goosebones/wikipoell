// A row of links showing where a page sits, e.g. "Categories › Footwear ›
// Boots". The last item is the current page and isn't a link.
// Props: items ({ label, href } from the top down to the current page).
import Link from "next/link";

export function Breadcrumb({
  items,
}: {
  items: { label: string; href: string }[];
}) {
  return (
    <nav className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((item, i) => (
        <span
          key={item.href}
          className="flex items-center gap-2"
        >
          {i > 0 && <span aria-hidden>›</span>}
          {i < items.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
