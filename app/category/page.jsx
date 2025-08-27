import { getCategories } from "@/lib/categories";
import Link from "next/link";

export default async function CategoryIndexPage() {
  const categories = await getCategories();

  const topLevelCategories = categories.filter((cat) => cat.parent === null);

  return (
    <div>
      <div className="my-4 mx-4">
        <h1 className="text-3xl font-bold mb-2">All Categories</h1>
      </div>

      {/* Category Content Placeholder */}
      <div className="p-6 border bg-muted/50">
        <p className="text-muted-foreground text-center">
          Content for All Categories will be displayed here
        </p>
      </div>
    </div>
  );
}
