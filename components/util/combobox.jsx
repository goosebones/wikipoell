import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/styles/components/ui/combobox";

export function GuntherCombobox({
  items = [],
  itemValue = "value",
  itemTitle = "title",
  placeholder = "Select",
  onSelect = () => null,
  multiple = false,
}) {
  return (
    <Combobox
      items={items}
      itemToStringLabel={(item) => item[itemTitle]}
      itemToStringValue={(item) => item[itemValue]}
      multiple={multiple}
      onValueChange={(value) => {
        if (multiple) {
          const valuesArray = Array.isArray(value)
            ? value
            : value
              ? [value]
              : [];
          onSelect(valuesArray.map((item) => item[itemValue]));
        } else {
          onSelect(value ? value[itemValue] : undefined);
        }
      }}
    >
      <ComboboxInput placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty>No items found</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem
              key={item[itemValue]}
              value={item}
            >
              {item[itemTitle]}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
