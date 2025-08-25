import { getCategories } from "@/lib/categories";
import { notFound } from "next/navigation";

export default async function CategoryPage({ params }) {
  const categories = await getCategories();
  const { slug } = await params;

  // Convert URL path segments back to dot notation for database lookup
  const categoryId = slug.join(".");

  // Find the category based on the dot-notation ID
  const currentCategory = categories.find((cat) => cat._id === categoryId);

  if (!currentCategory) {
    notFound();
  }

  return (
    <div>
      <div className="my-4 mx-4">
        <h1 className="text-3xl font-bold mb-2">{currentCategory.name}</h1>
      </div>

      {/* Category Content Placeholder */}
      <div className="p-6 border bg-muted/50">
        <p className="text-muted-foreground text-center">
          Content for {currentCategory.name} will be displayed here
        </p>
      </div>
    </div>
  );
}
