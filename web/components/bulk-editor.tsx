// The bulk edit form, laid out for desktop: a bar to choose one change (a
// field; set it, or for lists add or remove a value; and the value), then
// the garments as rows with a tick box each, all ticked to start. Applying
// changes every ticked garment and refreshes the list (fixed garments drop
// out of an issue's list).
// Props: garments (cards with their status), fields (label, tree and
// whether it holds several values, per field).
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkEdit } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { VocabCombobox } from "@/components/vocab-combobox";
import type { EditField } from "@/lib/garment-edit";
import type { GarmentCardData } from "@/lib/garments";
import type { TreeNode } from "@/types";

const select = "rounded-md bg-muted px-2.5 py-1.5 text-[13px] outline-none";

export function BulkEditor({
  garments,
  fields,
}: {
  garments: (GarmentCardData & { status: string })[];
  fields: {
    field: EditField;
    label: string;
    tree: Record<string, TreeNode>;
    multiple: boolean;
  }[];
}) {
  const router = useRouter();
  const [ticked, setTicked] = useState(new Set(garments.map((g) => g.id)));
  // The chosen field, by its place in `fields`.
  const [index, setIndex] = useState(0);
  const [op, setOp] = useState<"set" | "add" | "remove">("set");
  const [value, setValue] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = fields[index];
  const { field } = chosen;

  const tick = (id: string) =>
    setTicked((t) => {
      const next = new Set(t);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const apply = () =>
    startTransition(async () => {
      const result = await bulkEdit([...ticked], field, op, value[0] ?? null);
      setMessage(
        "error" in result
          ? (result.error ?? null)
          : `Changed ${result.changed} ${result.changed === 1 ? "garment" : "garments"}.`,
      );
      if (!("error" in result)) router.refresh();
    });

  return (
    <div className="mt-6">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-md border bg-background p-3 text-[13px]">
        <span className="font-medium">
          {ticked.size} of {garments.length} ticked
        </span>
        <select
          aria-label="Field"
          value={index}
          onChange={(e) => {
            const next = Number(e.target.value);
            setIndex(next);
            setOp(fields[next].multiple ? "add" : "set");
            setValue([]);
          }}
          className={select}
        >
          {fields.map((f, i) => (
            <option
              key={f.field}
              value={i}
            >
              {f.label}
            </option>
          ))}
        </select>
        {chosen.multiple ? (
          <select
            aria-label="Change"
            value={op}
            onChange={(e) =>
              setOp(e.target.value === "remove" ? "remove" : "add")
            }
            className={select}
          >
            <option value="add">add</option>
            <option value="remove">remove</option>
          </select>
        ) : (
          <span className="text-muted-foreground">set to</span>
        )}
        <div className="w-72">
          <VocabCombobox
            // A fresh box for each field.
            key={field}
            label={`${chosen.label} value`}
            tree={chosen.tree}
            value={value}
            onChange={setValue}
          />
        </div>
        <Button
          size="sm"
          disabled={pending || ticked.size === 0}
          onClick={apply}
        >
          {chosen.multiple || value[0] ? "Apply" : `Clear ${field}`}
        </Button>
        {message && <span className="text-muted-foreground">{message}</span>}
        {field === "model" && (
          <span className="basis-full text-[12px] text-muted-foreground">
            Setting a model also sets each garment’s category to the model’s.
          </span>
        )}
      </div>

      <table className="mt-4 w-full text-left text-[13px]">
        <thead className="eyebrow border-b border-muted">
          <tr>
            <th className="w-10 py-2">
              <input
                type="checkbox"
                aria-label="Tick all"
                checked={ticked.size === garments.length}
                onChange={(e) =>
                  setTicked(
                    new Set(e.target.checked ? garments.map((g) => g.id) : []),
                  )
                }
              />
            </th>
            <th className="w-14" />
            <th className="py-2 font-normal">Garment</th>
            <th className="font-normal">Material</th>
            <th className="font-normal">Color</th>
            <th className="font-normal">Category</th>
            <th className="font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-muted">
          {garments.map((g) => (
            <tr key={g.id}>
              <td className="py-1.5">
                <input
                  type="checkbox"
                  aria-label={`Tick ${g.title}`}
                  checked={ticked.has(g.id)}
                  onChange={() => tick(g.id)}
                />
              </td>
              <td>
                <div className="relative size-10 bg-muted">
                  {g.image && (
                    <Image
                      src={g.image}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  )}
                </div>
              </td>
              <td className="py-1.5">
                <Link
                  href={`/garment/${g.id}/edit`}
                  className="font-medium hover:underline"
                >
                  {g.title}
                </Link>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {g.code.join(" ")}
                </p>
              </td>
              <td>{g.material ?? "—"}</td>
              <td>{g.color ?? "—"}</td>
              <td>{g.category ?? "—"}</td>
              <td className="text-muted-foreground">{g.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
