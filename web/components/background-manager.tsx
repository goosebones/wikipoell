// The homepage backgrounds screen's controls: an upload button (the image is
// converted to WebP, stored in R2 and added to the rotation), then each
// background as a wide card with a switch for whether it's in the rotation
// and a Remove button, which asks first because it also deletes the file.
// Props: backgrounds ({ id, imageUrl, active }, newest first).
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  addHomepageBackground,
  removeHomepageBackground,
  setHomepageBackgroundActive,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Background = { id: string; imageUrl: string; active: boolean };

export function BackgroundManager({
  backgrounds,
}: {
  backgrounds: Background[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Each change refreshes the list from the server.
  const run = (change: () => Promise<void>) =>
    startTransition(async () => {
      await change();
      router.refresh();
    });

  const upload = (image: File) =>
    run(async () => {
      setError(null);
      const body = new FormData();
      body.set("image", image);
      const response = await fetch("/api/admin/backgrounds", {
        method: "POST",
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setError(result.error ?? "Upload failed.");
      await addHomepageBackground(result.url);
    });

  return (
    <div className="mt-6">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const image = e.target.files?.[0];
          if (image) upload(image);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          {pending ? "Working…" : "Upload a background"}
        </Button>
        <span className="text-[13px] text-muted-foreground">
          A wide photo works best; it’s shown full-screen behind the search.
        </span>
      </div>
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}

      <ul className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {backgrounds.map((b) => (
          <li key={b.id}>
            <div
              className={cn(
                "relative aspect-video overflow-hidden rounded-md bg-muted",
                !b.active && "opacity-40",
              )}
            >
              <Image
                src={b.imageUrl}
                alt=""
                fill
                sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={b.active}
                  disabled={pending}
                  onChange={(e) => {
                    const on = e.target.checked;
                    run(() => setHomepageBackgroundActive(b.id, on));
                  }}
                />
                In the rotation
              </label>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (confirm("Remove this background and delete its file?")) {
                    run(() => removeHomepageBackground(b.id));
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
