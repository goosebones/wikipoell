// Full-screen photo viewer. Shows one photo at a time, fitted to the screen,
// with previous/next buttons, arrow keys and swiping to move between photos,
// and Escape or × to close. Clicking the photo zooms it to full size; the
// zoomed photo can be scrolled around, and clicking again zooms back out.
// Props: images (photo URLs), alt (text for every photo), index (the photo
// shown, or null when closed), onIndexChange (called with the new index, or
// null to close).
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Lightbox({
  images,
  alt,
  index,
  onIndexChange,
}: {
  images: string[];
  alt: string;
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef<number | null>(null);
  const open = index !== null;
  const current = index ?? 0;

  const go = (step: number) => {
    setZoomed(false);
    onIndexChange((current + step + images.length) % images.length);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setZoomed(false);
          onIndexChange(null);
        }
      }}
    >
      <DialogContent className="top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 ring-0 sm:max-w-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>

        <div
          className={cn(
            "relative min-h-0 flex-1",
            zoomed ? "cursor-zoom-out overflow-auto" : "cursor-zoom-in",
          )}
          onClick={() => setZoomed(!zoomed)}
          onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (zoomed || touchStart.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStart.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchStart.current = null;
          }}
        >
          {/* A plain <img>: zooming shows the photo at its real size, which
              next/image's fill mode can't do. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[current]}
            alt={alt}
            className={
              zoomed
                ? "max-w-none"
                : "absolute inset-0 h-full w-full object-contain p-4 sm:p-10"
            }
          />
        </div>

        {images.length > 1 && (
          <div className="flex items-center justify-between px-4 pb-4 sm:px-10 sm:pb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go(-1)}
              aria-label="Previous photo"
            >
              <ChevronLeft />
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {current + 1} / {images.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => go(1)}
              aria-label="Next photo"
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
