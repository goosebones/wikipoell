import { getGarmentById } from "@/lib/garments";
import { notFound } from "next/navigation";
import ImageCarousel from "@/components/image-carousel";

export default async function GarmentPage({ params }) {
  const { slug } = await params;

  const garment = await getGarmentById(slug);
  if (!garment) {
    notFound();
  }

  return (
    <div>
      <div>
        <ImageCarousel images={garment.images} />
      </div>
      <div className="my-4 mx-4">
        <h1 className="text-2xl font-bold">{garment.title}</h1>

        <table className="w-full mt-4">
          <tbody>
            <tr className="border">
              <td className="border p-2">Color</td>
              <td className="border p-2">{garment.color}</td>
            </tr>
            <tr className="border">
              <td className="border p-2">Material</td>
              <td className="border p-2">{garment.material}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
