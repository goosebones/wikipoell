"use client";

import { useRef } from "react";
import { Button } from "@mantine/core";
import {
  Loader2Icon,
  Trash2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react";
import Image from "next/image";

const MAX_IMAGES = 9;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

export function ImageUpload({ value = [], onChange, disabled, garmentId }) {
  const inputRef = useRef(null);
  const filesByIdRef = useRef(new Map());

  const images = Array.isArray(value) ? value : [];
  const canAdd = images.length < MAX_IMAGES;

  const updateImages = (updater) => {
    onChange(updater);
  };

  const uploadOne = async (id, file) => {
    if (!garmentId) {
      // Should not happen in normal flow; mark as error.
      updateImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? { ...img, status: "error", error: "Missing garmentId" }
            : img,
        ),
      );
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("garmentId", garmentId);
    formData.set("imageId", id);
    try {
      const res = await fetch("/api/image-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      updateImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, url: data.url, status: "done" } : img,
        ),
      );
    } catch (err) {
      updateImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, status: "error", error: err.message } : img,
        ),
      );
    } finally {
      filesByIdRef.current.delete(id);
    }
  };

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !canAdd) return;
    const remaining = MAX_IMAGES - images.length;
    const toAdd = files.slice(0, remaining);
    const newEntries = toAdd.map(() => ({
      id: crypto.randomUUID(),
      status: "uploading",
    }));
    toAdd.forEach((file, i) =>
      filesByIdRef.current.set(newEntries[i].id, file),
    );
    updateImages((prev) => [...prev, ...newEntries]);
    newEntries.forEach((img) => {
      const file = filesByIdRef.current.get(img.id);
      if (file) uploadOne(img.id, file);
    });
  };

  const remove = (id) => {
    filesByIdRef.current.delete(id);
    updateImages((prev) => prev.filter((img) => img.id !== id));
  };

  const move = (index, delta) => {
    const i = index + delta;
    if (i < 0 || i >= images.length) return;
    updateImages((prev) => {
      const next = [...prev];
      [next[index], next[i]] = [next[i], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onFileChange}
        disabled={disabled || !canAdd}
      />
      <Button
        type="button"
        variant="light"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || !canAdd}
      >
        {canAdd
          ? `Add images (${images.length}/${MAX_IMAGES})`
          : `Maximum ${MAX_IMAGES} images`}
      </Button>

      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, index) => (
            <li
              key={img.id}
              className="relative flex aspect-square flex-col overflow-hidden rounded-md border bg-muted/30"
            >
              {img.status === "uploading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
                  <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {img.status === "error" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-destructive/10 p-2 text-center text-xs text-destructive">
                  <span>Failed</span>
                  <span className="line-clamp-2">{img.error}</span>
                </div>
              )}
              {img.url && (
                <Image
                  src={img.url}
                  alt="Garment image"
                  width={100}
                  height={100}
                  className="h-full w-full object-cover"
                />
              )}
              {!img.url &&
                img.status !== "uploading" &&
                img.status !== "error" && (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                    No preview
                  </div>
                )}

              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-1 bg-black/50 p-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="white"
                  className="text-white hover:bg-white/20"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  <ChevronUpIcon className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="white"
                  className="text-white hover:bg-white/20"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDownIcon className="size-3.5" />
                </Button>
                <div className="flex-grow" />
                <Button
                  type="button"
                  size="xs"
                  className="text-white hover:bg-destructive/80"
                  onClick={() => remove(img.id)}
                  disabled={img.status === "uploading"}
                  aria-label="Remove"
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
