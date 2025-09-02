import { getGarments } from "@/lib/garments";
import GarmentCard from "@/components/garment-card";

export default async function CategoryIndexPage() {
  const garments = await getGarments();

  return (
    <div>
      <div className="my-4 mx-4">
        <h1 className="text-3xl font-bold mb-2">All Categories</h1>
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
