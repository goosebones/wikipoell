// A garment as one row of the list view: a small thumbnail, title and article
// code, plus material, color and category columns from tablet width up.
// Links to the garment page.
// Props: the fields of GarmentCardData (id, title, code, image, material,
// color, category).
import Image from "next/image";
import Link from "next/link";
import type { GarmentCardData } from "@/lib/garments";

export function GarmentRow({
  id,
  title,
  code,
  image,
  material,
  color,
  category,
}: GarmentCardData) {
  return (
    <Link
      href={`/garment/${id}`}
      className="grid grid-cols-[56px_1fr] items-center gap-4 py-2 text-[13px] hover:bg-muted/60 md:grid-cols-[56px_1.4fr_1fr_1fr_0.7fr]"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image && (
          <Image
            src={image}
            alt={title}
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {code[0]} {code[1]}
        </p>
      </div>
      <p className="hidden text-muted-foreground md:block">{material}</p>
      <p className="hidden text-muted-foreground md:block">{color}</p>
      <p className="hidden text-muted-foreground md:block">{category}</p>
    </Link>
  );
}
