import { getCategories } from "@/lib/categories";
import CategoriesMenuClient from "./category-menu-client";

function buildCategoryTree(categories) {
  const categoryMap = {};
  const rootNodes = [];

  categories.forEach((category) => {
    categoryMap[category._id] = { ...category, children: [] };
  });

  categories.forEach((category) => {
    const node = categoryMap[category._id];
    if (category.parent === null) {
      rootNodes.push(node);
    } else {
      const parentNode = categoryMap[category.parent];
      if (parentNode) {
        parentNode.children.push(node);
      }
    }
  });

  return rootNodes;
}

export default async function CategoriesMenu() {
  const categories = await getCategories();
  const categoryTree = buildCategoryTree(categories);

  return <CategoriesMenuClient categoryTree={categoryTree} />;
}
