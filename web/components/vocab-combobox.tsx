// A type-to-search box for picking vocabulary values in the garment editor.
// Focusing it lists the options; typing narrows them (every word must appear
// in the option's code or full path, so "kang roo" finds ROOMS); arrows and
// Enter, or a click, pick one. A single-value box shows the chosen value's
// path and an × to clear it. A multi-value box shows the chosen values as
// removable chips and stays open for the next pick; Backspace in the empty
// box removes the last one. With `onAdd`, typing also offers "Add “…”" at the
// end of the list, for a value that doesn't exist yet.
// Props: label (for screen readers), tree (the vocabulary map), value (chosen
// ids), onChange, multiple, onAdd (called with the typed text).
"use client";

import { X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { byCode, labelPath, nodeLabel } from "@/lib/tree";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/types";

export function VocabCombobox({
  label,
  tree,
  value,
  onChange,
  multiple,
  onAdd,
}: {
  label: string;
  tree: Record<string, TreeNode>;
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  onAdd?: (typed: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Every node in tree order (parents before children), with its full path.
  const options = useMemo(() => {
    const nodes = Object.values(tree);
    const list: { id: string; path: string; text: string }[] = [];
    const walk = (parent: string | null) => {
      for (const node of nodes
        .filter((n) => n.parent === parent)
        .sort(byCode)) {
        const path = labelPath(tree, node._id).join(" › ");
        list.push({
          id: node._id,
          path,
          text: `${node.code ?? ""} ${path}`.toLowerCase(),
        });
        walk(node._id);
      }
    };
    walk(null);
    return list;
  }, [tree]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = options.filter(
    (o) =>
      !(multiple && value.includes(o.id)) &&
      words.every((w) => o.text.includes(w)),
  );

  const pick = (id: string) => {
    setQuery("");
    setActive(0);
    if (multiple) {
      onChange([...value, id]);
    } else {
      onChange([id]);
      setOpen(false);
    }
  };

  // "Add" sits after the options, as one more stop for the arrow keys.
  const addable = onAdd && query.trim();
  const stops = shown.length + (addable ? 1 : 0);
  const add = () => {
    onAdd?.(query.trim());
    setQuery("");
    setOpen(false);
  };

  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + stops) % Math.max(stops, 1));
    }
    // Enter picks rather than submitting the form.
    if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      pick(shown[active].id);
    } else if (
      e.key === "Enter" &&
      open &&
      addable &&
      active === shown.length
    ) {
      e.preventDefault();
      add();
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
    if (e.key === "Backspace" && multiple && !query && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const chosen = (id: string) => labelPath(tree, id).join(" › ");

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-[13px]">
        {multiple &&
          value.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-background py-0.5 pr-1 pl-2.5"
            >
              {chosen(id)}
              <button
                type="button"
                aria-label={`Remove ${tree[id] ? nodeLabel(tree[id]) : id}`}
                onClick={() => onChange(value.filter((v) => v !== id))}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          spellCheck={false}
          // A single value shows in the box until the user starts typing.
          value={open || multiple ? query : value[0] ? chosen(value[0]) : ""}
          placeholder={
            multiple
              ? value.length
                ? "Add another…"
                : "Type to add…"
              : open && value[0]
                ? chosen(value[0])
                : "None"
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={keyDown}
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 outline-none"
        />
        {!multiple && value[0] && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange([])}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {open && stops > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover py-1 text-[13px] text-popover-foreground shadow-lg"
        >
          {shown.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              // The keyboard's choice stays in view as it moves.
              ref={
                i === active
                  ? (el) => el?.scrollIntoView({ block: "nearest" })
                  : undefined
              }
              // Keeps focus in the box, so the list doesn't close first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.id)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer px-3 py-1",
                i === active && "bg-muted",
                value.includes(o.id) && "font-medium",
              )}
            >
              {o.path}
            </li>
          ))}
          {addable && (
            <li
              role="option"
              aria-selected={active === shown.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={add}
              onMouseEnter={() => setActive(shown.length)}
              className={cn(
                "cursor-pointer border-t px-3 py-1.5 text-muted-foreground",
                active === shown.length && "bg-muted text-foreground",
              )}
            >
              Add “{query.trim()}”…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
