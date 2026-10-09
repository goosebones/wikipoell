// A model's variants as a table: materials down the side, colors across the
// top, and in each cell the number of known garments in that combination,
// linking to the newest of them. Empty cells are combinations nobody has
// listed. Scrolls sideways on narrow screens.
// Props: matrix (from getVariantMatrix()), materials and colors (the
// vocabulary trees, for codes and labels).
import Link from "next/link";
import type { VariantCell } from "@/lib/garments";
import type { TreeNode } from "@/types";

type Tree = Record<string, TreeNode>;

// Order by code (or label for a family), with "none" last.
const order = (tree: Tree) => (a: string | null, b: string | null) => {
  if (a === null || b === null) return a === null ? 1 : -1;
  const key = (id: string) => tree[id]?.code ?? tree[id]?.label ?? id;
  return key(a).localeCompare(key(b), "en", { numeric: true });
};

export function VariantMatrix({
  matrix,
  materials,
  colors,
}: {
  matrix: {
    materials: (string | null)[];
    colors: (string | null)[];
    cells: Record<string, VariantCell>;
  };
  materials: Tree;
  colors: Tree;
}) {
  const rows = [...matrix.materials].sort(order(materials));
  const cols = [...matrix.colors].sort(order(colors));
  const head = (tree: Tree, id: string | null) =>
    id === null ? "—" : (tree[id]?.code ?? tree[id]?.label ?? id);
  const title = (tree: Tree, id: string | null) =>
    id === null ? "None recorded" : tree[id]?.label;

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="border-collapse font-mono text-[12px]">
        <thead>
          <tr>
            <th className="p-2 text-left font-normal text-muted-foreground">
              material \ color
            </th>
            {cols.map((c) => (
              <th
                key={String(c)}
                title={title(colors, c)}
                className="p-2 font-medium"
              >
                {head(colors, c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr
              key={String(m)}
              className="border-t border-muted"
            >
              <th
                title={title(materials, m)}
                className="p-2 text-left font-medium"
              >
                {head(materials, m)}
              </th>
              {cols.map((c) => {
                const cell = matrix.cells[`${m}|${c}`];
                return (
                  <td
                    key={String(c)}
                    className="p-1 text-center"
                  >
                    {cell && (
                      <Link
                        href={`/garment/${cell.garmentId}`}
                        className="block min-w-8 rounded bg-muted px-2 py-1 hover:bg-foreground hover:text-background"
                      >
                        {cell.count}
                      </Link>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
