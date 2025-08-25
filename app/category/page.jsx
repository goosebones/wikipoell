import { getCategories } from "@/lib/categories";
import Link from "next/link";

export default async function CategoryIndexPage() {
  const categories = await getCategories();

  const topLevelCategories = categories.filter((cat) => cat.parent === null);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">All Categories</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topLevelCategories.map((category) => (
          <Link
            key={category._id}
            href={`/category/${category._id}`}
            className="p-6 border rounded-lg hover:border-accent hover:bg-accent/5 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">{category.name}</h2>
            <p className="text-muted-foreground">
              Browse {category.name} and subcategories
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
