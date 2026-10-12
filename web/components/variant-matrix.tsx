// A model's variants as a table: materials down the side, colors across the
// top, and in each cell the number of known garments in that combination.
// A cell filters the page's grid to that combination; where the material or
// color is unrecorded (which a filter can't express) it opens the newest such
// garment instead. Empty cells are combinations nobody has listed. Scrolls
// sideways on narrow screens.
// Props: matrix (from getVariantMatrix(): rows, cols and cells).
import Link from "next/link";
import type { VariantAxis, VariantCell } from "@/lib/garments";

export function VariantMatrix({
  matrix,
}: {
  matrix: {
    rows: VariantAxis;
    cols: VariantAxis;
    cells: Record<string, VariantCell>;
  };
}) {
  return (
    <div className="mt-8 overflow-x-auto">
      <table className="border-collapse font-mono text-[12px]">
        <thead>
          <tr>
            <th className="p-2 text-left font-normal text-muted-foreground">
              material \ color
            </th>
            {matrix.cols.map((c) => (
              <th
                key={String(c.id)}
                title={c.title}
                className="p-2 font-medium"
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((m) => (
            <tr
              key={String(m.id)}
              className="border-t border-muted"
            >
              <th
                title={m.title}
                className="p-2 text-left font-medium"
              >
                {m.head}
              </th>
              {matrix.cols.map((c) => {
                const cell = matrix.cells[`${m.id}|${c.id}`];
                return (
                  <td
                    key={String(c.id)}
                    className="p-1 text-center"
                  >
                    {cell && (
                      <Link
                        href={
                          m.id && c.id
                            ? `?material=${m.id}&color=${c.id}`
                            : `/garment/${cell.garmentId}`
                        }
                        scroll={false}
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
