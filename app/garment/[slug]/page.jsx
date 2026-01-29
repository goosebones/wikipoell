import { getGarmentById } from "@/lib/garments";
import { notFound } from "next/navigation";
import ImageCarousel from "@/components/image-carousel";
import { getGarmentCode } from "@/lib/garments";
import { getProperties } from "@/lib/properties";

export default async function GarmentPage({ params }) {
  const { slug } = await params;

  const garment = await getGarmentById(slug);
  if (!garment) {
    notFound();
  }

  const {line1: garmentCodeLine1, line2: garmentCodeLine2} = getGarmentCode(garment);
  const properties = await getProperties();
  
  return (
    <div>
      <div>
        <ImageCarousel images={garment.images} />
      </div>
      <div className="my-4 mx-4">
        <h1 className="text-2xl font-bold">{garment.title}</h1>
        <h3>{garmentCodeLine1}</h3>
        <h2>{garmentCodeLine2}</h2>

        <table className="w-full mt-4">
          <tbody>
            {properties.map(property => {
              if (property.garmentKey in garment && property.garmentValue === garment[property.garmentKey]) {
                return (
                  <tr className="border" key={property._id}>
                    <td className="border p-2">{property.propertyType}</td>
                    <td className="border p-2">{garment[property.garmentKey]}</td>
                  </tr>    
                )
              }
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
