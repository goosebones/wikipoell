// The admin form for a garment's fields: the title override, then a
// type-to-search box per vocabulary field in article-code order. Choosing a
// model also sets the category to the model's suggested one (which can still
// be changed). A model, material or color that doesn't exist yet can be added
// from its box ("Add “…”"), with a short form under the field. Opened from a
// suggestion, the suggestion shows at the top and saving marks it accepted.
// Saving checks everything on the server; then a suggestion returns to the
// review queue, a published garment opens its page, and anything else stays
// here with a note.
// Props: garmentId, published, edit (the current values), fields (label,
// tree, whether it takes several values, and what a new value would be, per
// field), models (each model's name and suggested category), categories (the
// category tree), suggestion (the one being applied, or null).
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGarment } from "@/app/garment/actions";
import { AddVocabValue } from "@/components/add-vocab-value";
import { Button } from "@/components/ui/button";
import { VocabCombobox } from "@/components/vocab-combobox";
import type { EditField, GarmentEdit } from "@/lib/garment-edit";
import type { TreeNode } from "@/types";

export function GarmentEditor({
  garmentId,
  published,
  edit: initial,
  fields,
  models,
  categories,
  suggestion,
}: {
  garmentId: string;
  published: boolean;
  edit: GarmentEdit;
  fields: {
    field: EditField;
    label: string;
    tree: Record<string, TreeNode>;
    multiple: boolean;
    addAs: "model" | "materials" | "colors" | null;
  }[];
  models: Record<string, { label: string; category: string }>;
  categories: Record<string, TreeNode>;
  suggestion: {
    id: string;
    field: string;
    current: string;
    proposed: string;
    note: string;
  } | null;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(initial);
  const [adding, setAdding] = useState<{ field: EditField; typed: string }>();
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (field: EditField, ids: string[]) => {
    setStatus(null);
    setEdit((e) => ({
      ...e,
      [field]: ids,
      // A new model brings its suggested category.
      ...(field === "model" &&
        models[ids[0]] && { category: [models[ids[0]].category] }),
    }));
  };

  return (
    <form
      className="mt-8 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const ok = await saveGarment(garmentId, edit, suggestion?.id);
          if (ok && suggestion) router.push("/admin");
          else if (ok && published) router.push(`/garment/${garmentId}`);
          else setStatus(ok ? "saved" : "failed");
        });
      }}
    >
      {suggestion && (
        <div className="mb-6 rounded-md border p-4 text-[13px]">
          <p className="eyebrow">Suggestion · {suggestion.field}</p>
          <p className="mt-2">
            <span className="text-muted-foreground">Now:</span>{" "}
            {suggestion.current || "—"}
          </p>
          <p className="mt-1 font-medium">
            <span className="font-normal text-muted-foreground">
              Suggested:
            </span>{" "}
            {suggestion.proposed}
          </p>
          {suggestion.note && (
            <p className="mt-1 text-muted-foreground">{suggestion.note}</p>
          )}
          <p className="mt-2 text-[12px] text-muted-foreground">
            Make the change below; saving marks the suggestion accepted.
          </p>
        </div>
      )}

      <dl className="divide-y divide-muted border-y border-muted">
        <Row label="Title">
          <input
            aria-label="Title override"
            value={edit.overrideTitle ?? ""}
            onChange={(e) => {
              setStatus(null);
              setEdit({ ...edit, overrideTitle: e.target.value || null });
            }}
            placeholder={models[edit.model[0]]?.label ?? "Untitled"}
            className="w-full rounded-md bg-muted px-3 py-2 text-[14px] outline-none"
          />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Leave empty to use the model’s name.
          </p>
        </Row>
        {fields.map(({ field, label, tree, multiple, addAs }) => (
          <Row
            key={field}
            label={label}
          >
            <VocabCombobox
              label={label}
              tree={tree}
              value={edit[field]}
              onChange={(ids) => change(field, ids)}
              multiple={multiple}
              onAdd={addAs ? (typed) => setAdding({ field, typed }) : undefined}
            />
            {addAs && adding?.field === field && (
              <AddVocabValue
                // A fresh form for each "Add".
                key={adding.typed}
                kind={addAs}
                typed={adding.typed}
                tree={tree}
                categories={categories}
                onAdded={(id, category) => {
                  setAdding(undefined);
                  setStatus(null);
                  setEdit((e) => ({
                    ...e,
                    [field]: [id],
                    ...(category && { category: [category] }),
                  }));
                }}
                onCancel={() => setAdding(undefined)}
              />
            )}
          </Row>
        ))}
      </dl>
      <div className="mt-6 flex items-center gap-4">
        <Button
          type="submit"
          disabled={pending}
        >
          {suggestion ? "Save and accept" : "Save"}
        </Button>
        <Link
          href={suggestion || !published ? "/admin" : `/garment/${garmentId}`}
          className="text-[13px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        {status === "saved" && (
          <span className="text-[13px] text-muted-foreground">Saved.</span>
        )}
        {status === "failed" && (
          <span className="text-[13px] text-destructive">
            That didn’t save: a value may no longer exist. Reload and try again.
          </span>
        )}
      </div>
    </form>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <dt className="pt-1.5 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
