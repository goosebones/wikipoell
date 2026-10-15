// The links between the admin areas, shown at the top of every admin page:
// the review queue and the vocabulary editor, with the current one dark.
// Props: current ("review" | "vocabulary").
import Link from "next/link";
import { cn } from "@/lib/utils";

const AREAS = [
  { key: "review", label: "Review queue", href: "/admin" },
  { key: "vocabulary", label: "Vocabulary", href: "/admin/vocabulary" },
] as const;

export function AdminNav({
  current,
}: {
  current: (typeof AREAS)[number]["key"];
}) {
  return (
    <nav className="eyebrow flex gap-5">
      {AREAS.map((area) => (
        <Link
          key={area.key}
          href={area.href}
          className={cn(
            "hover:text-foreground",
            area.key === current && "text-foreground",
          )}
        >
          {area.label}
        </Link>
      ))}
    </nav>
  );
}
