"use client";

import { useMemo, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Collapse, UnstyledButton, Checkbox } from "@mantine/core";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { XIcon } from "lucide-react";

import { useProperties } from "@/components/context/property-context-provider";

function buildFilterMap(properties) {
  // {
  //   propertyType,
  //   garmentKey,
  //   options: [
  //     {optionName, optionDescription }
  //   ]
  // }
  return properties.reduce((acc, prop) => {
    if (acc[prop.garmentKey]) {
      acc[prop.garmentKey].options.push(prop);
    } else {
      acc[prop.garmentKey] = {
        propertyType: prop.propertyType,
        garmentKey: prop.garmentKey,
        options: [prop],
      };
    }
    return acc;
  }, {});
}

function FilterItem({
  propertyType,
  garmentKey,
  filterOptions,
  selectedGarmentValues,
  onToggle,
  onClear,
  isActive,
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <h3
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer" }}
        className={`flex items-center w-full ${isActive ? "bg-accent text-accent-foreground" : ""}`}
      >
        {propertyType}
        <div className="ml-2">
          {selectedGarmentValues.length > 0 &&
            `(${selectedGarmentValues.length})`}
        </div>
        {selectedGarmentValues.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevents opening/closing the section when clearing
              onClear(garmentKey);
            }}
            className="ml-2"
          >
            <XIcon />
          </button>
        )}
        <div className="flex-1"></div>
        {isOpen ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
      </h3>
      {isOpen && (
        <div>
          {filterOptions.map((option) => {
            const isChecked = selectedGarmentValues.includes(
              option.garmentValue,
            );
            return (
              <div
                key={option._id}
                className="ml-2 flex items-center gap-2"
              >
                <Checkbox
                  id={`${propertyType}-${option._id}`}
                  checked={isChecked}
                  onChange={() => {
                    onToggle(garmentKey, option.garmentValue, isChecked);
                  }}
                  label={option.description || option.garmentValue}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterMenuClient() {
  const [rootOpen, setRootOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { properties } = useProperties();
  const filterMap = useMemo(() => buildFilterMap(properties), [properties]);

  const selectedBygarmentKey = useMemo(() => {
    const result = {};
    Object.keys(filterMap).forEach((garmentKey) => {
      result[garmentKey] = searchParams.getAll(garmentKey);
    });
    return result;
  }, [filterMap, searchParams]);

  const updateQueryParams = useCallback(
    (garmentKey, garmentValue, currentlyChecked) => {
      const params = new URLSearchParams(searchParams.toString());
      if (currentlyChecked) {
        params.delete(garmentKey, garmentValue);
      } else {
        params.append(garmentKey, garmentValue);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearFilter = useCallback(
    (garmentKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(garmentKey);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div>
      <UnstyledButton
        className={`flex items-center justify-between w-full text-lg font-semibold transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground p-2 rounded ${rootOpen ? "bg-accent text-accent-foreground" : ""}`}
        onClick={() => setRootOpen((o) => !o)}
      >
        Filters
        {rootOpen ? (
          <ChevronDownIcon className="size-5" />
        ) : (
          <ChevronRightIcon className="size-5" />
        )}
      </UnstyledButton>
      <Collapse in={rootOpen}>
        <div className="pl-4">
          {Object.entries(filterMap).map(([garmentKey, filterInfo]) => (
            <FilterItem
              key={garmentKey}
              propertyType={filterInfo.propertyType}
              garmentKey={garmentKey}
              filterOptions={filterInfo.options}
              selectedGarmentValues={selectedBygarmentKey[garmentKey] || []}
              isActive={selectedBygarmentKey[garmentKey]?.length > 0}
              onToggle={updateQueryParams}
              onClear={clearFilter}
            />
          ))}
        </div>
      </Collapse>
    </div>
  );
}
