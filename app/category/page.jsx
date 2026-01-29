import { getGarments } from "@/lib/garments";
import GarmentCard from "@/components/garment-card";
import FilterMenuClient from "@/components/filter/filter-menu-client";

export default async function CategoryIndexPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const garments = await getGarments(resolvedSearchParams);

  return (
    <div>
      <div className="my-4 mx-4">
        <h1 className="text-3xl font-bold mb-2">All Categories</h1>
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
