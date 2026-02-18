"use client";

import { createContext, useContext } from "react";

const CategoriesContext = createContext(null);
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

export function CategoriesProvider({ children, categories }) {
  const categoryTree = buildCategoryTree(categories);
  return (
    <CategoriesContext.Provider value={{ categories, categoryTree }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
