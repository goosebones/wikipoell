"use client";

import { useState } from "react";
import { Select } from "@mantine/core";
import { useCategories } from "@/components/context/category-context-provider";

function valueToPath(value) {
  if (!value) return [];
  const parts = value.split(".");
  return parts.map((_, i) => parts.slice(0, i + 1).join("."));
}

export default function CategoryTreeSelectClient({ value, onChange }) {
  const { categoryTree } = useCategories();

  // Internal representation: full path of ids from root to the current leaf.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => valueToPath(value));

  const handleSelect = (level, categoryId) => {
    // When a level is (re)selected, throw away any deeper selections.
    const next = selectedCategoryIds.slice(0, level);
    next[level] = categoryId;
    setSelectedCategoryIds(next);

    if (onChange) {
      const deepestId = next.length > 0 ? next[next.length - 1] : null;
      onChange(deepestId);
    }
  };

  const renderCategorySelectors = () => {
    const selectors = [];
    let currentItems = categoryTree;
    let level = 0;

    while (currentItems && currentItems.length > 0) {
      const selectedIdAtLevel = selectedCategoryIds[level] || null;
      const currentLevel = level;

      selectors.push(
        <div
          className="pb-2"
          key={currentLevel}
        >
          <Select
            placeholder="Select category"
            data={currentItems.map((c) => ({
              value: c._id,
              label: c.name ?? c._id,
            }))}
            value={selectedIdAtLevel}
            searchable
            onChange={(id) => handleSelect(currentLevel, id ?? undefined)}
          />
        </div>,
      );

      // Stop if nothing is selected at this level yet.
      if (!selectedIdAtLevel) break;

      const selectedNode = currentItems.find(
        (n) => n._id === selectedIdAtLevel,
      );

      // Stop when there's no deeper level to go.
      if (
        !selectedNode ||
        !selectedNode.children ||
        selectedNode.children.length === 0
      ) {
        break;
      }

      // Continue one level deeper.
      currentItems = selectedNode.children;
      level += 1;
    }

    return selectors;
  };

  return <>{renderCategorySelectors()}</>;
}
