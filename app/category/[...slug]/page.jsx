import { getCategories } from "@/lib/categories";
import { getGarments } from "@/lib/garments";
import GarmentCard from "@/components/garment-card";
import { notFound } from "next/navigation";
import FilterMenuClient from "@/components/filter/filter-menu-client";

export default async function CategoryPage({ params, searchParams }) {
  const categories = await getCategories();
  const { slug } = await params;

  const resolvedSearchParams = await searchParams;

  const categoryId = slug.join(".");
  const currentCategory = categories.find((cat) => cat._id === categoryId);
  if (!currentCategory) {
    notFound();
  }

  const garments = await getGarments({
    ...resolvedSearchParams,
    category: categoryId,
  });

  return (
    <div>
      <div className="my-4 mx-4">
        <h1 className="text-3xl font-bold mb-2">{currentCategory.name}</h1>
      </div>

      <div>
        <FilterMenuClient />
      </div>

      {garments.length > 0 ? (
        <div className="flex flex-wrap gap-4 justify-center">
          {garments.map((garment) => {
            return (
              <div className="w-45" key={garment._id}>
                <GarmentCard garment={garment} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          <p>No garments found</p>
        </div>
      )}
    </div>
  );
}
