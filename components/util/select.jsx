"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/styles/components/ui/select";

export function GuntherSelect({
  onSelect = () => null,
  items = [],
  itemValue = "value",
  itemTitle = "title",
  placeholder = "Select",
}) {
  return (
    <Select>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => {
            return (
              <SelectItem
                key={i[itemValue]}
                value={i[itemValue]}
                onClick={() => onSelect(i[itemValue])}
              >
                {i[itemTitle]}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
