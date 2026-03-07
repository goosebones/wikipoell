import Link from "next/link";
import { cn } from "@/styles/lib/utils";
import { getCategories } from "@/lib/categories";

export async function CategoryBreadcrumb({ categoryId, className }) {
  if (!categoryId || typeof categoryId !== "string" || !categoryId.trim()) {
    return null;
  }

  const segments = categoryId.split(".");
  if (segments.length === 0) return null;

  const categories = await getCategories();
  const items = segments.map((segment, index) => {
    const pathSegments = segments.slice(0, index + 1);
    const href = `/category/${pathSegments.join("/")}`;
    const label =
      categories.find((category) => category._id === pathSegments.join("."))
        ?.name ?? segment;
    return { href, label };
  });

  return (
    <div className={cn("flex gap-1", className)}>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-1"
        >
          <Link
            href={item.href}
            key={index}
            className="underline cursor-pointer"
          >
            {item.label}
          </Link>
          {index < items.length - 1 && (
            <div className="text-muted-foreground/70">&gt;</div>
          )}
        </div>
      ))}
    </div>
  );
}
