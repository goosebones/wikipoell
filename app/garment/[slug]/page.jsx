import { Info } from "lucide-react";
import { getGarmentById, getSimilarGarments } from "@/lib/garments";
import { notFound } from "next/navigation";
import ImageCarousel from "@/components/image-carousel";
import { getGarmentCode, getOrderedGarmentPropertyList } from "@/lib/garments";
import { getProperties } from "@/lib/properties";
import { Tooltip } from "@mantine/core";
import { getUserByClerkId } from "@/lib/users";
import Link from "next/link";
import {
  GarmentUploaderDisplay,
  GarmentSourceDisplay,
} from "@/components/garment/garment-owner-display";
import { CategoryBreadcrumb } from "@/components/category/category-breadcrumb";
import GarmentCardList from "@/components/garment/garment-card-list";

export default async function GarmentPage({ params }) {
  const { slug } = await params;

  const garment = await getGarmentById(slug);
  if (!garment) {
    notFound();
  }

  const { line1: garmentCodeLine1, line2: garmentCodeLine2 } =
    getGarmentCode(garment);
  const [uploader, properties, similarGarments] = await Promise.all([
    getUserByClerkId(garment.uploadedByUserId),
    getProperties(),
    getSimilarGarments(garment, { limit: 10 }),
  ]);
  const orderedGarmentPropertyList = getOrderedGarmentPropertyList();

  const formatGarmentKey = (key) =>
    key
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const getBrowseHref = (garmentKey, garmentValue) => {
    const params = new URLSearchParams();
    params.append(garmentKey, garmentValue);
    return `/category?${params.toString()}`;
  };

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
              if (garmentKey in garment && !!garment[garmentKey]) {
                let items = [];
                if (Array.isArray(garment[garmentKey])) {
                  items = garment[garmentKey].map((item) => {
                    return {
                      value: item,
                      label:
                        properties.find(
                          (p) =>
                            p.garmentKey === garmentKey &&
                            p.garmentValue === item,
                        )?.description || item,
                    };
                  });
                } else {
                  items = [
                    {
                      value: garment[garmentKey],
                      label:
                        properties.find(
                          (p) =>
                            p.garmentKey === garmentKey &&
                            p.garmentValue === garment[garmentKey],
                        )?.description || garment[garmentKey],
                    },
                  ];
                }

                const propertyType = properties.find(
                  (p) => p.garmentKey === items[0].value,
                )?.propertyType;
                return (
                  <tr
                    className="border"
                    key={garmentKey}
                  >
                    <td className="border p-2">
                      {propertyType || formatGarmentKey(garmentKey)}
                    </td>
                    <td className="border p-2">
                      <div className="flex flex-col">
                        {items.map((item) => (
                          <div
                            key={item.value}
                            className="flex items-center gap-2"
                          >
                            <span>{item.value}</span>
                            <Tooltip
                              label={item.label}
                              withArrow
                              events={{ hover: true, focus: true, touch: true }}
                              openDelay={100}
                              closeDelay={150}
                            >
                              <span className="inline-block cursor-pointer">
                                <Info size={16} />
                              </span>
                            </Tooltip>
                            <div className="flex-1 flex justify-end">
                              <Link
                                href={getBrowseHref(garmentKey, item.value)}
                                className="text-xs underline text-muted-foreground hover:text-foreground"
                              >
                                Browse
                              </Link>
                            </div>

                            <br />
                          </div>
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

        {similarGarments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-3">Similar Garments</h2>
            <GarmentCardList garments={similarGarments} />
          </div>
        )}
      </div>
    </div>
  );
}
