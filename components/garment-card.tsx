// A garment in a grid: its cover photo (3:4, with a slow zoom on hover), title
// and two-line article code, linking to the garment page. Used by every grid
// on the site.
// Props: id, title, code (the two lines from articleCode()), image (cover
// photo URL; a blank tile shows if the garment has none).
import Image from "next/image";
import Link from "next/link";

export function GarmentCard({
  id,
  title,
  code,
  image,
}: {
  id: string;
  title: string;
  code: readonly [string, string];
  image?: string;
}) {
  return (
    <Link
      href={`/garment/${id}`}
      className="group block"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {image && (
          <Image
            src={image}
            alt={title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <p className="mt-3 text-[13px] leading-snug font-medium">{title}</p>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        {code[0]} {code[1]}
      </p>
    </Link>
  );
}
