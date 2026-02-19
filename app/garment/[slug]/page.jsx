import { Info } from "lucide-react";
import { getGarmentById } from "@/lib/garments";
import { notFound } from "next/navigation";
import ImageCarousel from "@/components/image-carousel";
import { getGarmentCode, getOrderedGarmentPropertyList } from "@/lib/garments";
import { getProperties } from "@/lib/properties";
import { GuntherTooltip } from "@/components/util/tooltip";

export default async function GarmentPage({ params }) {
  const { slug } = await params;

  const garment = await getGarmentById(slug);
  if (!garment) {
    notFound();
  }

  const { line1: garmentCodeLine1, line2: garmentCodeLine2 } =
    getGarmentCode(garment);
  const properties = await getProperties();
  const orderedGarmentPropertyList = getOrderedGarmentPropertyList();

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
            {orderedGarmentPropertyList.map((garmentKey) => {
              if (garmentKey in garment) {
                const property = properties.find(
                  (p) =>
                    p.garmentKey === garmentKey &&
                    p.garmentValue === garment[garmentKey]
                );
                if (property) {
                  return (
                    <tr
                      className="border"
                      key={property._id}
                    >
                      <td className="border p-2">{property.propertyType}</td>
                      <td className="border p-2">
                        <div className="flex items-center gap-2 justify-between">
                          {garment[garmentKey]}
                          <GuntherTooltip content={property.description}>
                            <Info size={20} />
                          </GuntherTooltip>
                        </div>
                      </td>
                    </tr>
                  );
                }
              }
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
