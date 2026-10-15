// The admin form for a garment's fields: the title override, then a
// type-to-search box per vocabulary field in article-code order. Choosing a model also sets the
// category to the model's suggested one (which can still be changed).
// Saving checks everything on the server; published garments then open
// their page, others stay here with a note.
// Props: garmentId, published, edit (the current values), fields (label,
// tree and whether it takes several values, per field), models (each model's
// name and suggested category).
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGarment } from "@/app/garment/actions";
import { VocabCombobox } from "@/components/vocab-combobox";
import { Button } from "@/components/ui/button";
import type { EditField, GarmentEdit } from "@/lib/garment-edit";
import type { TreeNode } from "@/types";

export function GarmentEditor({
  garmentId,
  published,
  edit: initial,
  fields,
  models,
}: {
  garmentId: string;
  published: boolean;
  edit: GarmentEdit;
  fields: {
    field: EditField;
    label: string;
    tree: Record<string, TreeNode>;
    multiple: boolean;
  }[];
  models: Record<string, { label: string; category: string }>;
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(initial);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (field: EditField, ids: string[]) => {
    setStatus(null);
    setEdit((e) => ({
      ...e,
      [field]: ids,
      // A new model brings its suggested category.
      ...(field === "model" &&
        ids[0] && { category: [models[ids[0]].category] }),
    }));
  };

  return (
    <form
      className="mt-8 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const ok = await saveGarment(garmentId, edit);
          if (ok && published) router.push(`/garment/${garmentId}`);
          else setStatus(ok ? "saved" : "failed");
        });
      }}
    >
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
        {fields.map(({ field, label, tree, multiple }) => (
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
            />
          </Row>
        ))}
      </dl>
      <div className="mt-6 flex items-center gap-4">
        <Button
          type="submit"
          disabled={pending}
        >
          Save
        </Button>
        <Link
          href={published ? `/garment/${garmentId}` : "/admin"}
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
