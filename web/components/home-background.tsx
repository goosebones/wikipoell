// The homepage's full-bleed background: the active homepage photos, one at a
// time, crossfading to the next every 8 seconds, under a dark wash so the
// text and search box on top stay readable.
// Props: images (photo URLs, in order).
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function HomeBackground({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(
      () => setCurrent((i) => (i + 1) % images.length),
      24 * 1000,
    );
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    <div className="absolute inset-0 -z-10 bg-foreground">
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          loading={i === 0 ? "eager" : "lazy"}
          className={cn(
            "object-cover transition-opacity duration-1000",
            i === current ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}
