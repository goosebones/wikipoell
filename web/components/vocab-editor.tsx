// The editor for one vocabulary, laid out for desktop. A filter box narrows
// the list (for trees, matches keep their parents), and a form at the top
// adds an entry. Every entry is a row edited in place: its code (or a
// model's number, which can't change), its name, a model's category or a
// tree node's parent (changing the parent moves it, and everything beneath
// it), and how many garments use it, linking to them. Save appears once a
// row changes; Delete only for entries nothing uses.
// Props: name (the vocabulary), title, shape ("flat" | "models" | "tree"),
// codes (whether entries have CCP codes), entries (in order, with depth and
// garments link), nodes (the vocabulary as a tree, for choosing a parent),
// categories (for a model's category).
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addVocabEntry,
  changeVocabEntry,
  deleteVocabEntry,
} from "@/app/admin/actions";
import { FilterInput } from "@/components/filter-input";
import { Button } from "@/components/ui/button";
import { VocabCombobox } from "@/components/vocab-combobox";
import { filterTree, labelPath } from "@/lib/tree";
import { cn } from "@/lib/utils";
import type { VocabEntry, VocabName } from "@/lib/vocab-edit";
import type { TreeNode } from "@/types";

type Shape = "flat" | "models" | "tree";
type Entry = VocabEntry & { depth: number; href: string | null };
type Shared = {
  name: VocabName;
  shape: Shape;
  codes: boolean;
  nodes: Record<string, TreeNode>;
  categories: Record<string, TreeNode>;
};

const input =
  "w-full rounded-md bg-muted px-2.5 py-1.5 text-[13px] outline-none";
// Code, name, category or parent, garments, buttons. Narrow windows scroll
// the table sideways rather than squashing it.
const columns =
  "grid min-w-[52rem] grid-cols-[8rem_1fr_18rem_4rem_9rem] items-center gap-3";

export function VocabEditor({
  title,
  entries,
  ...shared
}: Shared & { title: string; entries: Entry[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches =
    shared.shape === "tree"
      ? filterTree(shared.nodes, Object.values(shared.nodes), query)
      : null;
  const shown = entries.filter((e) =>
    !q
      ? true
      : matches
        ? matches.has(e.id)
        : `${e.code ?? ""} ${e.label}`.toLowerCase().includes(q),
  );
  const extra =
    shared.shape === "models"
      ? "Category"
      : shared.shape === "tree"
        ? "Goes under"
        : "";

  return (
    <div className="mt-6">
      <FilterInput
        value={query}
        onChange={setQuery}
        placeholder={`Filter ${title.toLowerCase()}…`}
      />
      <div className="overflow-x-auto pb-48">
        <AddEntry {...shared} />
        <div className={cn(columns, "eyebrow mt-6 border-b border-muted pb-2")}>
          <span>{shared.shape === "models" ? "Number" : "Code"}</span>
          <span>Name</span>
          <span>{extra}</span>
          <span className="text-right">Garments</span>
          <span />
        </div>
        <ul className="divide-y divide-muted">
          {shown.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              {...shared}
            />
          ))}
        </ul>
      </div>
      {shown.length === 0 && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      )}
    </div>
  );
}

// One entry, edited in place.
function Row({ entry, ...shared }: Shared & { entry: Entry }) {
  const { name, shape, codes, nodes, categories } = shared;
  const router = useRouter();
  const [code, setCode] = useState(entry.code ?? "");
  const [label, setLabel] = useState(entry.label);
  const [parent, setParent] = useState(entry.parent);
  const [category, setCategory] = useState(entry.category);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // What screen readers call this row: its code where it has one, since
  // names repeat ("100% Cotton").
  const called = entry.code || entry.label || entry.id;
  const changed =
    code !== (entry.code ?? "") ||
    label !== entry.label ||
    parent !== entry.parent ||
    category !== entry.category;

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (!result.error) router.refresh();
    });

  return (
    <li className="py-1.5">
      <div className={columns}>
        <div style={{ paddingLeft: `${entry.depth * 1}rem` }}>
          {codes ? (
            <input
              aria-label={`Code of ${called}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={cn(input, "font-mono")}
            />
          ) : (
            <span className="font-mono text-[13px] text-muted-foreground">
              {shape === "models" ? entry.id : ""}
            </span>
          )}
        </div>
        <input
          aria-label={`Name of ${called}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={input}
        />
        <div>
          {shape === "models" && (
            <VocabCombobox
              label={`Category of ${called}`}
              tree={categories}
              value={category ? [category] : []}
              onChange={(ids) => setCategory(ids[0] ?? null)}
            />
          )}
          {shape === "tree" && (
            <VocabCombobox
              label={`Parent of ${called}`}
              // A node can't go under itself or anything beneath it.
              tree={Object.fromEntries(
                Object.entries(nodes).filter(
                  ([id]) => id !== entry.id && !id.startsWith(`${entry.id}.`),
                ),
              )}
              value={parent ? [parent] : []}
              onChange={(ids) => setParent(ids[0] ?? null)}
            />
          )}
        </div>
        <span className="text-right font-mono text-[12px] text-muted-foreground">
          {entry.href && entry.count > 0 ? (
            <Link
              href={entry.href}
              className="hover:text-foreground hover:underline"
            >
              {entry.count}
            </Link>
          ) : (
            entry.count
          )}
        </span>
        <div className="flex justify-end gap-1">
          {changed && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  changeVocabEntry(name, entry.id, {
                    code,
                    label,
                    parent,
                    category,
                  }),
                )
              }
            >
              Save
            </Button>
          )}
          {entry.deletable && !changed && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => deleteVocabEntry(name, entry.id))}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
      {parent !== entry.parent && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          Saving moves it (and everything beneath it) to{" "}
          {parent ? labelPath(nodes, parent).join(" › ") : "the top level"}, and
          updates every garment using it.
        </p>
      )}
      {error && <p className="mt-1 text-[12px] text-destructive">{error}</p>}
    </li>
  );
}

// The form for a new entry: its code (or a model's number), name, and a
// model's category or a tree node's parent.
function AddEntry({ name, shape, codes, nodes, categories }: Shared) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [place, setPlace] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = await addVocabEntry(name, {
        code,
        label,
        parent: shape === "tree" ? place[0] : null,
        category: shape === "models" ? place[0] : null,
      });
      setError(result.error ?? null);
      if (result.error) return;
      setCode("");
      setLabel("");
      router.refresh();
    });

  return (
    <div className="mt-4 rounded-md border p-3">
      <div className={columns}>
        {codes || shape === "models" ? (
          <input
            aria-label={shape === "models" ? "New model's number" : "New code"}
            placeholder={shape === "models" ? "Number" : "Code"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={cn(input, "bg-background font-mono")}
          />
        ) : (
          <span />
        )}
        <input
          aria-label="New name"
          placeholder="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={cn(input, "bg-background")}
        />
        <div>
          {shape !== "flat" && (
            <VocabCombobox
              label={shape === "models" ? "New model's category" : "Goes under"}
              tree={shape === "models" ? categories : nodes}
              value={place}
              onChange={setPlace}
            />
          )}
        </div>
        <span />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={pending}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </div>
      {error && <p className="mt-1 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
