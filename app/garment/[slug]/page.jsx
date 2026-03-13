import { Info } from "lucide-react";
import { getGarmentById } from "@/lib/garments";
import { notFound } from "next/navigation";
import ImageCarousel from "@/components/image-carousel";
import { getGarmentCode, getOrderedGarmentPropertyList } from "@/lib/garments";
import { getProperties } from "@/lib/properties";
import { Tooltip } from "@mantine/core";
import { getUserByClerkId } from "@/lib/users";
import {
  GarmentUploaderDisplay,
  GarmentSourceDisplay,
} from "@/components/garment-owner-display";
import { CategoryBreadcrumb } from "@/components/category/category-breadcrumb";

export default async function GarmentPage({ params }) {
  const { slug } = await params;

  const garment = await getGarmentById(slug);
  if (!garment) {
    notFound();
  }

  const uploader = await getUserByClerkId(garment.uploadedByUserId);

  const { line1: garmentCodeLine1, line2: garmentCodeLine2 } =
    getGarmentCode(garment);
  const properties = await getProperties();
  const orderedGarmentPropertyList = getOrderedGarmentPropertyList();

  const formatGarmentKey = (key) =>
    key
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  return (
    <div>
      <div>
        <ImageCarousel images={garment.images} />
      </div>

      <div className="my-4 mx-4">
        <h1 className="text-2xl font-bold">{garment.title}</h1>
        <h3>{garmentCodeLine1}</h3>
        <h2>{garmentCodeLine2}</h2>

        <CategoryBreadcrumb
          className="mt-2"
          categoryId={garment.category}
        />

        <table className="w-full mt-4">
          <tbody>
            {orderedGarmentPropertyList.map((garmentKey) => {
              if (garmentKey in garment) {
                const property = properties.find(
                  (p) =>
                    p.garmentKey === garmentKey &&
                    p.garmentValue === garment[garmentKey],
                );
                return (
                  <tr
                    className="border"
                    key={garmentKey}
                  >
                    <td className="border p-2">
                      {property?.propertyType || formatGarmentKey(garmentKey)}
                    </td>
                    <td className="border p-2">
                      <div className="flex items-center gap-2 justify-between">
                        {garment[garmentKey]}
                        {property &&
                          (property.description ? (
                            <Tooltip
                              label={property.description}
                              withArrow
                            >
                              <span className="inline-block cursor-pointer">
                                <Info size={20} />
                              </span>
                            </Tooltip>
                          ) : (
                            <Info size={20} />
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
        <GarmentUploaderDisplay user={uploader ?? undefined} />
        <GarmentSourceDisplay source={garment.source} />
      </div>
    </div>
  );
}
