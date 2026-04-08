"use client";

import { useMemo, useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MultiSelect,
  Button,
  SimpleGrid,
  Collapse,
  UnstyledButton,
} from "@mantine/core";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { useProperties } from "@/components/context/property-context-provider";

function buildFilterMap(properties) {
  return properties.reduce((acc, prop) => {
    if (!acc[prop.garmentKey]) {
      acc[prop.garmentKey] = {
        propertyType: prop.propertyType,
        garmentKey: prop.garmentKey,
        options: [],
      };
    }

    const optionLabel = prop.description ?? prop.garmentValue;
    const hasOption = acc[prop.garmentKey].options.some(
      (option) => option.value === prop.garmentValue,
    );

    if (!hasOption) {
      acc[prop.garmentKey].options.push({
        value: prop.garmentValue,
        label: optionLabel,
      });
    }

    return acc;
  }, {});
}

export default function FilterMenuClient() {
  const [filtersOpen, setFiltersOpen] = useState(true);
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

  const setFilterValues = useCallback(
    (garmentKey, selectedValues) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(garmentKey);
      selectedValues.forEach((value) => params.append(garmentKey, value));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearAllFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const hasActiveFilters = useMemo(
    () =>
      Object.values(selectedBygarmentKey).some(
        (selectedValues) => selectedValues.length > 0,
      ),
    [selectedBygarmentKey],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <UnstyledButton
          className="flex items-center gap-2 text-lg font-semibold"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span>Filters</span>
          {filtersOpen ? (
            <ChevronDownIcon className="size-5" />
          ) : (
            <ChevronRightIcon className="size-5" />
          )}
        </UnstyledButton>
        {hasActiveFilters && (
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        )}
      </div>

      <Collapse in={filtersOpen}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
          {Object.entries(filterMap).map(([garmentKey, filterInfo]) => (
            <MultiSelect
              key={garmentKey}
              label={filterInfo.propertyType}
              placeholder={`Select ${filterInfo.propertyType.toLowerCase()}`}
              data={filterInfo.options}
              value={selectedBygarmentKey[garmentKey] || []}
              searchable
              clearable
              onChange={(values) => setFilterValues(garmentKey, values)}
            />
          ))}
        </SimpleGrid>
      </Collapse>
    </div>
  );
}
