"use client";

import { useState, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/styles/components/ui/carousel";
import Image from "next/image";

export default function ImageCarousel({ images = [] }) {
  const [api, setApi] = useState();
  // Embla starts on the first slide, and there is one snap point per slide,
  // so both counters are known before the carousel initialises.
  const [current, setCurrent] = useState(1);
  const count = images.length;

  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-64 bg-muted flex items-center justify-center text-muted-foreground">
        No images available
      </div>
    );
  }

  return (
    <div className="relative">
      <Carousel
        className="w-full"
        setApi={setApi}
        opts={{
          loop: true,
        }}
      >
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={index}>
              <div className="w-full h-96 rounded-lg relative bg-muted">
                <Image
                  src={image.url}
                  alt={`Image ${index + 1}`}
                  className="object-contain"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={index === 0}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <CarouselPrevious
            className="left-3 z-10"
            variant="filled"
          />
        )}

        {images.length > 1 && (
          <CarouselNext
            className="left-6 z-10"
            variant="filled"
          />
        )}
      </Carousel>

      {/* Image counter */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
        {current} of {count}
      </div>
    </div>
  );
}
