"use client";

import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { useSidebar } from "./sidebar-menu";
import { cn } from "@/styles/lib/utils";

export default function UploadGarmentLink({ className }) {
  const sidebar = useSidebar();

  const handleClick = () => {
    sidebar?.closeSidebar?.();
  };

  return (
    <Link
      href="/garment/create"
      onClick={handleClick}
      className={cn(
        "flex items-center justify-between w-full text-lg font-semibold transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      Upload Garment
      <ChevronRightIcon className="size-5" />
    </Link>
  );
}
