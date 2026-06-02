"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Text } from "@mantine/core";

const SIZES = {
  sm: { width: 72, height: 96, gap: 6, radius: 4, sizes: "72px" },
  lg: { width: 120, height: 160, gap: 8, radius: 6, sizes: "120px" },
};

function normalizeImages(images) {
  return images.map((img) => (typeof img === "string" ? { url: img } : img));
}

export default function GarmentImageStrip({
  images,
  size = "lg",
  draggable = false,
  onReorder,
  onImageClick,
  showCoverBadge = false,
  caption,
}) {
  const normalized = normalizeImages(images);
  const dims = SIZES[size] ?? SIZES.lg;

  const dragIndex = useRef(null);
  const didDrag = useRef(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function onDragStart(i) {
    dragIndex.current = i;
    didDrag.current = false;
  }

  function onDragOver(e, i) {
    e.preventDefault();
    didDrag.current = true;
    setDragOverIndex(i);
  }

  function onDrop(i) {
    const from = dragIndex.current;
    if (from === null || from === i) {
      setDragOverIndex(null);
      return;
    }
    const next = [...normalized];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    onReorder?.(next);
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function onDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  return (
    <>
      {caption && (
        <Text
          size="xs"
          c="dimmed"
          mb={6}
        >
          {caption}
        </Text>
      )}
      <div
        style={{
          display: "flex",
          gap: dims.gap,
          overflowX: draggable ? "auto" : undefined,
          paddingBottom: draggable ? 8 : undefined,
          flexShrink: 0,
        }}
      >
        {normalized.map((img, i) => (
          <div
            key={img.url}
            draggable={draggable}
            onDragStart={draggable ? () => onDragStart(i) : undefined}
            onDragOver={draggable ? (e) => onDragOver(e, i) : undefined}
            onDrop={draggable ? () => onDrop(i) : undefined}
            onDragEnd={draggable ? onDragEnd : undefined}
            onClick={
              onImageClick
                ? () => {
                    if (!didDrag.current) onImageClick(img.url);
                  }
                : undefined
            }
            style={{
              flexShrink: 0,
              width: dims.width,
              height: dims.height,
              position: "relative",
              borderRadius: dims.radius,
              overflow: "hidden",
              cursor: onImageClick || draggable ? "pointer" : undefined,
              border: draggable
                ? dragOverIndex === i
                  ? "2px dashed #aaa"
                  : "2px solid transparent"
                : undefined,
              opacity: draggable && dragIndex.current === i ? 0.4 : 1,
              background: "#f1f3f5",
            }}
          >
            <Image
              src={img.url}
              alt={draggable ? `Image ${i + 1}` : ""}
              fill
              style={{ objectFit: "cover" }}
              sizes={dims.sizes}
            />
            {showCoverBadge && i === 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                  fontSize: 10,
                  textAlign: "center",
                  padding: "2px 0",
                }}
              >
                Cover
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
