import { getProperties } from "@/lib/properties";
import FiltersMenuClient from "./filters-menu-client";

function buildFilterMap(properties) {
  // {
  //   propertyType,
  //   garmentKey,
  //   options: [
  //     {optionName, optionDescription }
  //   ]
  // }
  const filterMap = {};
  properties.forEach((prop) => {
    if (prop.garmentKey in filterMap) {
      filterMap[prop.garmentKey].options.push(prop);
    } else {
      filterMap[prop.garmentKey] = {
        propertyType: prop.propertyType,
        garmentKey: prop.garmentKey,
        options: [prop],
      };
    }
  });
  return filterMap;
}

export default async function FiltersMenu() {
  const properties = await getProperties();
  const filters = buildFilterMap(properties);
  return <FiltersMenuClient filterMap={filters} />;
}
