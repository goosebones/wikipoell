// A short inline form in the garment editor for adding a value that doesn't
// exist yet: a model (number, name and category) or a material or color
// (code, name and where it sits in the tree). It starts from what was typed
// into the field's search box. Once added, the vocabulary is refreshed and
// the new value is handed back to be picked.
// Props: kind ("model" | "materials" | "colors"), typed (the search text),
// tree (the field's tree, for choosing a parent), categories (for a model's
// category), onAdded (called with the new id, and a model's category),
// onCancel.
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createModel, createTreeNode } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { VocabCombobox } from "@/components/vocab-combobox";
import type { TreeNode } from "@/types";

const input =
  "w-full rounded-md bg-background px-3 py-1.5 text-[13px] outline-none";

export function AddVocabValue({
  kind,
  typed,
  tree,
  categories,
  onAdded,
  onCancel,
}: {
  kind: "model" | "materials" | "colors";
  typed: string;
  tree: Record<string, TreeNode>;
  categories: Record<string, TreeNode>;
  onAdded: (id: string, category?: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const isModel = kind === "model";
  const [code, setCode] = useState(
    isModel ? typed.replace(/\D/g, "") : typed.toUpperCase(),
  );
  const [label, setLabel] = useState("");
  // A model's category, or a node's parent.
  const [place, setPlace] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const result = isModel
        ? await createModel({ number: code, label, category: place[0] })
        : await createTreeNode(kind, { code, label, parent: place[0] });
      if ("error" in result) return setError(result.error);
      router.refresh();
      onAdded(result.id, isModel ? place[0] : undefined);
    });

  return (
    <div className="mt-2 space-y-2 rounded-md border p-3 text-[13px]">
      <p className="font-medium">
        Add a new {isModel ? "model" : kind.slice(0, -1)}
      </p>
      <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        <input
          aria-label={isModel ? "Model number" : "Code"}
          placeholder={isModel ? "Number" : "Code (optional)"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={`${input} font-mono`}
        />
        <input
          aria-label="Name"
          placeholder="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={input}
        />
      </div>
      <VocabCombobox
        label={isModel ? "Category" : "Goes under"}
        tree={isModel ? categories : tree}
        value={place}
        onChange={setPlace}
      />
      <p className="text-[12px] text-muted-foreground">
        {isModel
          ? "Its category fills in for garments of this model."
          : "Where it sits, e.g. Leather › Kangaroo. Leave empty for a new top level."}
      </p>
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={add}
        >
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
