// The text box above a list that narrows it as you type. Just the input; the
// list does the filtering.
// Props: value, onChange (called with the new text), placeholder.
"use client";

export function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-sm rounded-md bg-muted px-3 py-2 text-[14px] outline-none"
    />
  );
}
