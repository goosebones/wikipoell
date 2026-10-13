// A garment's photos: one large photo at a time, with a strip of thumbnails
// below it (the current one in full color, the rest greyed out). Swipe the
// large photo on phones, or use the arrows beside it; tap a thumbnail to jump
// to it. Tapping the large photo opens the full-screen lightbox, and the
// gallery follows along to whichever photo was last viewed there.
// Photos are always shown whole: each sits in a square frame and is fitted
// inside it rather than cropped. Square because the photos are a mix, mostly
// landscape with many tall portraits, and it wastes the least space across
// both.
// Props: images (photo URLs, cover first), alt (text for every photo).
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GarmentGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);

  // Scroll the large photo to `i`; the strip's onScroll then sets `current`.
  const goTo = (i: number, behavior: ScrollBehavior = "smooth") => {
    const el = strip.current!;
    el.scrollTo({ left: i * el.clientWidth, behavior });
  };

  // Keep the current thumbnail in view when there are more than fit.
  useEffect(() => {
    thumbs.current?.children[current]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [current]);

  if (images.length === 0) {
    return <div className="aspect-square bg-muted" />;
  }

  return (
    // On desktop the gallery is sized to the window height, so the large
    // photo and the thumbnails fit on screen together, and centered in its
    // column. `min-w-0` stops a long thumbnail row from widening the page's
    // grid column; the row scrolls instead.
    <div className="min-w-0 lg:mx-auto lg:w-full lg:max-w-[calc(100vh-14rem)]">
      <div className="relative">
        <div
          ref={strip}
          className="-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:mx-0"
          onScroll={(e) => {
            const el = e.currentTarget;
            setCurrent(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setOpen(i)}
              className="relative aspect-square w-full shrink-0 cursor-zoom-in snap-center"
            >
              <Image
                src={src}
                alt={alt}
                fill
                loading={i === 0 ? "eager" : "lazy"}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain"
              />
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous photo"
              onClick={() => goTo(Math.max(0, current - 1))}
              className="absolute top-1/2 left-0 hidden -translate-y-1/2 bg-background/70 sm:inline-flex"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next photo"
              onClick={() => goTo(Math.min(images.length - 1, current + 1))}
              className="absolute top-1/2 right-0 hidden -translate-y-1/2 bg-background/70 sm:inline-flex"
            >
              <ChevronRight />
            </Button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div
          ref={thumbs}
          className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]"
        >
          {images.map((src, i) => (
            <button
              key={src}
              // Neighbours slide over; longer jumps go straight there.
              onClick={() =>
                goTo(i, Math.abs(i - current) > 1 ? "instant" : "smooth")
              }
              aria-label={`Photo ${i + 1}`}
              aria-current={i === current}
              className={cn(
                "relative size-16 shrink-0 bg-muted transition",
                i === current
                  ? "opacity-100"
                  : "opacity-40 grayscale hover:opacity-70",
              )}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="64px"
                // Same file as the large photo; eager like it, or Next takes
                // the cover for a lazy image and warns.
                loading={i === 0 ? "eager" : "lazy"}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        images={images}
        alt={alt}
        index={open}
        onIndexChange={(i) => {
          // Follow the lightbox, so closing it leaves the gallery on the
          // photo that was last viewed.
          if (i !== null) goTo(i, "instant");
          setOpen(i);
        }}
      />
    </div>
  );
}
